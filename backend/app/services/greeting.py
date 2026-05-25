"""Builds the contextual greeting payload for a recognized user."""
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Reservation, User, UserBadge, Visit


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

    first_name = user.full_name.split(" ")[0]
    ordinal = visit_count + 1  # this arrival isn't recorded yet at greeting time
    message = f"Hoş geldin {first_name}, {ordinal}. ziyaretin."
    if current_reservation is not None:
        message += (
            f" Bugün {current_reservation.resource_name} rezervasyonun var."
        )

    return {
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
