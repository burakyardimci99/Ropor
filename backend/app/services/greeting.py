"""Builds the contextual greeting payload for a recognized user."""
from datetime import datetime, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Reservation, User, UserBadge, Visit


async def _visit_streak_days(session: AsyncSession, user_id: UUID, today) -> int:
    """Consecutive calendar days (lab timezone) the user has visited, including
    today's arrival. 1 means "here today only", 2 means "today + yesterday", etc.
    """
    tz = ZoneInfo(settings.lab_timezone)
    rows = await session.execute(
        select(Visit.entered_at).where(Visit.user_id == user_id)
    )
    visit_days = {dt.astimezone(tz).date() for (dt,) in rows if dt is not None}

    streak = 1  # the current arrival counts as today
    day = today - timedelta(days=1)
    while day in visit_days:
        streak += 1
        day -= timedelta(days=1)
    return streak


async def build_greeting(session: AsyncSession, user_id: UUID) -> dict | None:
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        return None

    now = datetime.now(timezone.utc)

    visit_count = (
        await session.scalar(
            select(func.count()).select_from(Visit).where(Visit.user_id == user_id)
        )
    ) or 0

    last_visit = await session.scalar(
        select(Visit)
        .where(Visit.user_id == user_id)
        .order_by(Visit.entered_at.desc())
        .limit(1)
    )

    current_reservation = await session.scalar(
        select(Reservation)
        .where(
            Reservation.user_id == user_id,
            Reservation.starts_at <= now,
            Reservation.ends_at >= now,
        )
        .order_by(Reservation.starts_at)
        .limit(1)
    )

    badge_count = (
        await session.scalar(
            select(func.count())
            .select_from(UserBadge)
            .where(UserBadge.user_id == user_id)
        )
    ) or 0

    today_local = now.astimezone(ZoneInfo(settings.lab_timezone)).date()
    streak_days = await _visit_streak_days(session, user_id, today_local)

    first_name = user.full_name.split(" ")[0]
    ordinal = visit_count + 1  # this arrival isn't recorded yet at greeting time
    message = f"Hoş geldin {first_name}, {ordinal}. ziyaretin."
    if streak_days >= 2:
        message += f" {streak_days} gündür üst üste buradasın!"
    if current_reservation is not None:
        message += (
            f" Bugün {current_reservation.resource_name} rezervasyonun var."
        )

    return {
        "streak_days": streak_days,
        "user": {
            "id": str(user.id),
            "full_name": user.full_name,
            "role": user.role,
            "interests": user.interests,
            "avatar_url": user.avatar_url,
        },
        "visit_count": visit_count,
        "badge_count": badge_count,
        "current_reservation": (
            {
                "resource_name": current_reservation.resource_name,
                "starts_at": current_reservation.starts_at.isoformat(),
                "ends_at": current_reservation.ends_at.isoformat(),
            }
            if current_reservation
            else None
        ),
        "recent_session": (
            {"entered_at": last_visit.entered_at.isoformat()} if last_visit else None
        ),
        "message": message,
    }
