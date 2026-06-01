"""Admin panel API. Bearer-token protected via require_admin."""
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_admin
from app.models import (
    USER_ROLES,
    Badge,
    FaceEmbedding,
    OnboardingSession,
    User,
    UserBadge,
    Visit,
    VisitorSession,
)
from app.schemas.admin import AdminBadgeCreate, AdminUserPatch
from app.services import badges as badges_svc
from app.services import users as users_svc

logger = logging.getLogger("api.admin")

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


# ── Stats ──────────────────────────────────────────────────────────────────
@router.get("/stats")
async def stats(session: AsyncSession = Depends(get_session)) -> dict:
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    return {
        "users": int(await session.scalar(select(func.count(User.id))) or 0),
        "active_users": int(
            await session.scalar(
                select(func.count(User.id)).where(User.is_active.is_(True))
            )
            or 0
        ),
        "embeddings": int(
            await session.scalar(select(func.count(FaceEmbedding.id))) or 0
        ),
        "visits_24h": int(
            await session.scalar(
                select(func.count(Visit.id)).where(Visit.entered_at >= day_ago)
            )
            or 0
        ),
        "active_onboarding": int(
            await session.scalar(
                select(func.count(OnboardingSession.id)).where(
                    OnboardingSession.status == "in_progress"
                )
            )
            or 0
        ),
        "active_visitors": int(
            await session.scalar(
                select(func.count(VisitorSession.id)).where(
                    VisitorSession.exited_at.is_(None)
                )
            )
            or 0
        ),
        "generated_at": now.isoformat(),
    }


# ── Users ──────────────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(
    q: str = "",
    role: str | None = None,
    limit: int = 50,
    offset: int = 0,
    sort: str = "recent",  # recent | visits | name
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    visit_count = func.count(Visit.id).label("visit_count")
    last_seen = func.max(Visit.entered_at).label("last_seen")
    stmt = (
        select(User, visit_count, last_seen)
        .outerjoin(Visit, Visit.user_id == User.id)
        .group_by(User.id)
        .limit(min(limit, 200))
        .offset(max(offset, 0))
    )
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(User.full_name.ilike(like), User.email.ilike(like)))
    if role:
        stmt = stmt.where(User.role == role)
    if sort == "visits":
        stmt = stmt.order_by(visit_count.desc(), User.created_at.desc())
    elif sort == "name":
        stmt = stmt.order_by(User.full_name.asc())
    else:
        stmt = stmt.order_by(User.created_at.desc())

    rows = (await session.execute(stmt)).all()
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "leaderboard_opt_in": u.leaderboard_opt_in,
            "email_verified": u.email_verified_at is not None,
            "created_at": u.created_at.isoformat(),
            "visit_count": int(vc or 0),
            "last_seen": ls.isoformat() if ls else None,
        }
        for u, vc, ls in rows
    ]


@router.get("/users/{user_id}")
async def user_detail(
    user_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict:
    # Reuse the public profile shape and add admin-only fields.
    profile = await users_svc.get_profile(session, user_id)
    user = await session.get(User, user_id)
    embeddings = int(
        await session.scalar(
            select(func.count(FaceEmbedding.id)).where(FaceEmbedding.user_id == user_id)
        )
        or 0
    )
    profile["email"] = user.email
    profile["is_active"] = user.is_active
    profile["created_at"] = user.created_at.isoformat()
    profile["kvkk_consented_at"] = (
        user.kvkk_consented_at.isoformat() if user.kvkk_consented_at else None
    )
    profile["embeddings_count"] = embeddings
    return profile


@router.patch("/users/{user_id}")
async def patch_user(
    user_id: UUID,
    body: AdminUserPatch,
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kullanıcı bulunamadı.")
    patch = body.model_dump(exclude_unset=True)
    if "role" in patch and patch["role"] not in USER_ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Geçersiz rol: {patch['role']}")
    for k, v in patch.items():
        setattr(user, k, v)
    await session.commit()
    logger.info("admin patch user=%s fields=%s", user_id, list(patch.keys()))
    return {"status": "updated", "fields": list(patch.keys())}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict:
    """KVKK erasure — cascades all user data."""
    result = await users_svc.delete_user(session, user_id)
    logger.info("admin delete user=%s", user_id)
    return result


# ── Sessions ───────────────────────────────────────────────────────────────
@router.get("/visitor-sessions")
async def visitor_sessions(
    active_only: bool = True,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    stmt = select(VisitorSession).order_by(VisitorSession.entered_at.desc()).limit(limit)
    if active_only:
        stmt = stmt.where(VisitorSession.exited_at.is_(None))
    rows = (await session.scalars(stmt)).all()
    return [
        {
            "id": str(v.id),
            "visitor_name": v.visitor_name,
            "host_user_id": str(v.host_user_id) if v.host_user_id else None,
            "purpose": v.purpose,
            "entered_at": v.entered_at.isoformat(),
            "exited_at": v.exited_at.isoformat() if v.exited_at else None,
            "expires_at": v.expires_at.isoformat(),
        }
        for v in rows
    ]


@router.get("/onboarding-sessions")
async def onboarding_sessions(
    active_only: bool = True,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    stmt = select(OnboardingSession).order_by(OnboardingSession.started_at.desc()).limit(limit)
    if active_only:
        stmt = stmt.where(OnboardingSession.status.in_(["in_progress", "awaiting_email_verify"]))
    rows = (await session.scalars(stmt)).all()
    return [
        {
            "id": str(o.id),
            "full_name": o.full_name,
            "email": o.email,
            "role": o.role,
            "status": o.status,
            "started_at": o.started_at.isoformat(),
            "expires_at": o.expires_at.isoformat(),
        }
        for o in rows
    ]


# ── Visits ─────────────────────────────────────────────────────────────────
@router.get("/visits")
async def recent_visits(
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    stmt = (
        select(Visit, User.full_name)
        .join(User, User.id == Visit.user_id)
        .order_by(Visit.entered_at.desc())
        .limit(min(limit, 200))
    )
    rows = (await session.execute(stmt)).all()
    return [
        {
            "id": str(v.id),
            "user_id": str(v.user_id),
            "user_name": name,
            "entered_at": v.entered_at.isoformat(),
            "exited_at": v.exited_at.isoformat() if v.exited_at else None,
            "detection_confidence": v.detection_confidence,
        }
        for v, name in rows
    ]


# ── Badges ─────────────────────────────────────────────────────────────────
@router.get("/badges")
async def list_badges(session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows = (await session.scalars(select(Badge).order_by(Badge.code))).all()
    return [
        {
            "id": str(b.id),
            "code": b.code,
            "name": b.name,
            "description": b.description,
            "icon_url": b.icon_url,
        }
        for b in rows
    ]


@router.post("/badges")
async def create_badge(
    body: AdminBadgeCreate, session: AsyncSession = Depends(get_session)
) -> dict:
    existing = await session.scalar(select(Badge).where(Badge.code == body.code))
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu code zaten kayıtlı.")
    badge = Badge(**body.model_dump())
    session.add(badge)
    await session.commit()
    logger.info("admin create badge=%s", body.code)
    return {"id": str(badge.id), "code": badge.code}


@router.post("/badges/evaluate-all")
async def evaluate_all_badges(
    session: AsyncSession = Depends(get_session),
) -> dict:
    awarded = await badges_svc.evaluate_all(session)
    logger.info("admin evaluate-all badges awarded=%s", awarded)
    return {"awarded": awarded, "users_changed": len(awarded)}


@router.post("/users/{user_id}/badges/evaluate")
async def evaluate_user_badges(
    user_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict:
    awarded = await badges_svc.evaluate_user(session, user_id)
    return {"awarded": awarded}


@router.post("/users/{user_id}/badges/{badge_code}")
async def award_badge(
    user_id: UUID,
    badge_code: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kullanıcı bulunamadı.")
    badge = await session.scalar(select(Badge).where(Badge.code == badge_code))
    if badge is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rozet bulunamadı.")
    existing = await session.scalar(
        select(UserBadge).where(
            UserBadge.user_id == user_id, UserBadge.badge_id == badge.id
        )
    )
    if existing is not None:
        return {"status": "already_awarded"}
    session.add(UserBadge(user_id=user_id, badge_id=badge.id))
    await session.commit()
    logger.info("admin award badge=%s user=%s", badge_code, user_id)
    return {"status": "awarded"}
