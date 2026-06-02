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

    # Enrich the presence rows with each person's latest visit so the kiosk can
    # show *what* they're working on (daily_intent) and *since when*.
    ids = []
    for p in inside:
        raw_id = p.get("id")
        if raw_id:
            try:
                ids.append(UUID(str(raw_id)))
            except ValueError:
                continue

    latest: dict[UUID, dict] = {}
    if ids:
        rows = (
            await session.execute(
                select(Visit.user_id, Visit.entered_at, Visit.daily_intent)
                .where(Visit.user_id.in_(ids))
                .order_by(Visit.user_id, Visit.entered_at.desc())
            )
        ).all()
        for uid, entered, intent in rows:
            if uid not in latest:  # first row per user == most recent visit
                latest[uid] = {"entered_at": entered, "daily_intent": intent}

    currently_inside = []
    for p in inside:
        detail = None
        raw_id = p.get("id")
        if raw_id:
            try:
                detail = latest.get(UUID(str(raw_id)))
            except ValueError:
                detail = None
        entered_at = detail["entered_at"] if detail else None
        currently_inside.append(
            {
                "id": raw_id,
                "full_name": p.get("full_name"),
                "role": p.get("role"),
                "interests": p.get("interests") or [],
                "intent": detail["daily_intent"] if detail else None,
                "entered_at": entered_at.isoformat() if entered_at else None,
            }
        )

    recent = (
        await session.execute(
            select(User.full_name, Visit.entered_at)
            .join(User, User.id == Visit.user_id)
            .order_by(Visit.entered_at.desc())
            .limit(10)
        )
    ).all()

    return {
        "currently_inside": currently_inside,
        "machines": [],
        "recent_activity": [
            {"full_name": n, "entered_at": e.isoformat()} for n, e in recent
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def weekly_density(session: AsyncSession, days: int = 7) -> dict:
    """Visits per day for the trailing ``days`` window (oldest -> newest).

    Timestamps are bucketed by their UTC calendar date. The response always
    contains exactly ``days`` entries so the chart axis stays stable even on
    days with no traffic.
    """
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start = today - timedelta(days=days - 1)

    entered = (
        await session.scalars(
            select(Visit.entered_at).where(Visit.entered_at >= start)
        )
    ).all()

    counts: dict[str, int] = {
        (start + timedelta(days=i)).date().isoformat(): 0 for i in range(days)
    }
    for e in entered:
        if e is None:
            continue
        aware = e if e.tzinfo else e.replace(tzinfo=timezone.utc)
        key = aware.astimezone(timezone.utc).date().isoformat()
        if key in counts:
            counts[key] += 1

    series = [{"date": date, "count": count} for date, count in counts.items()]
    peak = max((d["count"] for d in series), default=0)
    return {
        "days": series,
        "peak": peak,
        "total": sum(d["count"] for d in series),
        "generated_at": now.isoformat(),
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
