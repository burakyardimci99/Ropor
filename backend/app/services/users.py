"""User profile read/update and KVKK erasure."""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Badge, Reservation, User, UserBadge, Visit

PATCHABLE_FIELDS = {"bio", "interests", "avatar_url", "leaderboard_opt_in"}


async def get_profile(session: AsyncSession, user_id: UUID) -> dict:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kullanıcı bulunamadı.")

    recent_visits = (
        await session.scalars(
            select(Visit)
            .where(Visit.user_id == user_id)
            .order_by(Visit.entered_at.desc())
            .limit(5)
        )
    ).all()

    now = datetime.now(timezone.utc)
    current_reservation = await session.scalar(
        select(Reservation)
        .where(
            Reservation.user_id == user_id,
            Reservation.starts_at <= now,
            Reservation.ends_at >= now,
        )
        .limit(1)
    )

    badges = (
        await session.execute(
            select(Badge.code, Badge.name, UserBadge.earned_at)
            .join(UserBadge, UserBadge.badge_id == Badge.id)
            .where(UserBadge.user_id == user_id)
        )
    ).all()

    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "role": user.role,
        "interests": user.interests,
        "bio": user.bio,
        "avatar_url": user.avatar_url,
        "leaderboard_opt_in": user.leaderboard_opt_in,
        "email_verified": user.email_verified_at is not None,
        "recent_visits": [{"entered_at": v.entered_at.isoformat()} for v in recent_visits],
        "current_reservation": (
            {
                "resource_name": current_reservation.resource_name,
                "starts_at": current_reservation.starts_at.isoformat(),
                "ends_at": current_reservation.ends_at.isoformat(),
            }
            if current_reservation
            else None
        ),
        "badges": [
            {"code": c, "name": n, "earned_at": e.isoformat()} for c, n, e in badges
        ],
    }


async def update_user(session: AsyncSession, user_id: UUID, patch: dict) -> dict:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kullanıcı bulunamadı.")
    for key, value in patch.items():
        if value is not None and key in PATCHABLE_FIELDS:
            setattr(user, key, value)
    await session.commit()
    return {"status": "updated"}


async def delete_user(session: AsyncSession, user_id: UUID) -> dict:
    """KVKK erasure — cascades embeddings, visits, reservations, badges."""
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kullanıcı bulunamadı.")
    await session.delete(user)
    await session.commit()
    return {"status": "deleted", "user_id": str(user_id)}
