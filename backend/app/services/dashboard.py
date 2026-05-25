"""Aggregations for the ambient dashboard, leaderboard, and reservations."""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Reservation, User, UserBadge, Visit
from app.services import presence

_PERIOD_DAYS = {"weekly": 7, "monthly": 30, "all": None}


async def leaderboard(
    session: AsyncSession, period: str = "monthly", limit: int = 20
) -> list[dict]:
    days = _PERIOD_DAYS.get(period, 30)
    visit_count = func.count(Visit.id).label("visit_count")
    stmt = (
        select(User.id, User.full_name, visit_count)
        .join(Visit, Visit.user_id == User.id)
        .where(User.leaderboard_opt_in.is_(True), User.is_active.is_(True))
        .group_by(User.id, User.full_name)
        .order_by(visit_count.desc())
        .limit(limit)
    )
    if days is not None:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        stmt = stmt.where(Visit.entered_at >= since)

    rows = (await session.execute(stmt)).all()

    # Badge counts for the ranked users.
    out = []
    for uid, name, vc in rows:
        badge_count = (
            await session.scalar(
                select(func.count())
                .select_from(UserBadge)
                .where(UserBadge.user_id == uid)
            )
        ) or 0
        out.append(
            {
                "user_id": str(uid),
                "full_name": name,
                "visit_count": int(vc),
                "badge_count": int(badge_count),
            }
        )
    return out


async def live(session: AsyncSession) -> dict:
    inside = await presence.list_inside()

    recent = (
        await session.execute(
            select(User.full_name, Visit.entered_at)
            .join(User, User.id == Visit.user_id)
            .order_by(Visit.entered_at.desc())
            .limit(10)
        )
    ).all()

    return {
        "currently_inside": inside,
        "machines": [],
        "recent_activity": [
            {"full_name": n, "entered_at": e.isoformat()} for n, e in recent
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def reservations_today(session: AsyncSession) -> list[dict]:
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    rows = (
        await session.scalars(
            select(Reservation)
            .where(Reservation.starts_at >= start, Reservation.starts_at < end)
            .order_by(Reservation.starts_at)
        )
    ).all()
    return [_reservation_dict(r) for r in rows]


async def reservations_for_user(session: AsyncSession, user_id: UUID) -> list[dict]:
    rows = (
        await session.scalars(
            select(Reservation)
            .where(Reservation.user_id == user_id)
            .order_by(Reservation.starts_at.desc())
        )
    ).all()
    return [_reservation_dict(r) for r in rows]


def _reservation_dict(r: Reservation) -> dict:
    return {
        "id": str(r.id),
        "resource_name": r.resource_name,
        "starts_at": r.starts_at.isoformat(),
        "ends_at": r.ends_at.isoformat(),
        "status": r.status,
    }
