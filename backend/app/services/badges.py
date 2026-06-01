"""Declarative badge catalog + auto-award engine.

A `BadgeDef` is a code, display copy, and a pure rule function that takes the
user's full list of visit timestamps and returns whether the user qualifies.

`evaluate_user` is called after every recognized visit and also exposed via
an admin backfill endpoint. The DB row for each badge code is upserted by
`ensure_catalog`, so re-running is safe.

Newly awarded badges trigger an `achievement` broadcast over the kiosk WS.
"""
import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Badge, User, UserBadge, Visit
from app.ws.manager import kiosk_manager

logger = logging.getLogger("services.badges")


@dataclass
class BadgeDef:
    code: str
    name: str
    description: str
    rule: Callable[[list[datetime]], bool]


# ── Helpers used by rules ──────────────────────────────────────────────────
def _consecutive_day_streak(visits: list[datetime]) -> int:
    """Longest run of consecutive calendar days that had at least one visit."""
    if not visits:
        return 0
    days = sorted({v.date() for v in visits})
    best = cur = 1
    for i in range(1, len(days)):
        if (days[i] - days[i - 1]).days == 1:
            cur += 1
            best = max(best, cur)
        else:
            cur = 1
    return best


def _hour_count(visits: list[datetime], start_h: int, end_h: int) -> int:
    """Visits whose hour is in [start_h, end_h). Supports a wrap-around window
    (e.g. start=22 end=6 means 22:00-23:59 plus 00:00-05:59)."""
    if start_h <= end_h:
        return sum(1 for v in visits if start_h <= v.hour < end_h)
    return sum(1 for v in visits if v.hour >= start_h or v.hour < end_h)


# ── Catalog ────────────────────────────────────────────────────────────────
CATALOG: list[BadgeDef] = [
    BadgeDef(
        "first_visit", "İlk Adım", "İlk lab ziyaretin.",
        lambda v: len(v) >= 1,
    ),
    BadgeDef(
        "decabronze", "10 Ziyaret", "10 ziyareti tamamladın.",
        lambda v: len(v) >= 10,
    ),
    BadgeDef(
        "centurion", "Yüzler Kulübü", "100 ziyareti devirdin.",
        lambda v: len(v) >= 100,
    ),
    BadgeDef(
        "streak_3", "3 Gün Seri", "3 gün üst üste lab'a uğradın.",
        lambda v: _consecutive_day_streak(v) >= 3,
    ),
    BadgeDef(
        "streak_7", "7 Gün Seri", "7 gün üst üste lab'a uğradın.",
        lambda v: _consecutive_day_streak(v) >= 7,
    ),
    BadgeDef(
        "streak_30", "30 Gün Seri", "30 gün üst üste lab'a uğradın.",
        lambda v: _consecutive_day_streak(v) >= 30,
    ),
    BadgeDef(
        "night_owl", "Gece Kuşu", "5+ kez gece (22:00-06:00) lab'da çalıştın.",
        lambda v: _hour_count(v, 22, 6) >= 5,
    ),
    BadgeDef(
        "early_bird", "Erkenci", "5+ kez sabah erken (05:00-08:00) lab'da çalıştın.",
        lambda v: _hour_count(v, 5, 8) >= 5,
    ),
    BadgeDef(
        "weekend_warrior", "Hafta Sonu Savaşçısı", "5+ hafta sonu ziyareti.",
        lambda v: sum(1 for d in v if d.weekday() >= 5) >= 5,
    ),
]

_CATALOG_BY_CODE: dict[str, BadgeDef] = {b.code: b for b in CATALOG}


async def ensure_catalog(session: AsyncSession) -> dict[str, Badge]:
    """Upsert every catalog badge into DB; returns code -> Badge."""
    out: dict[str, Badge] = {}
    for bdef in CATALOG:
        existing = await session.scalar(select(Badge).where(Badge.code == bdef.code))
        if existing is None:
            existing = Badge(
                code=bdef.code, name=bdef.name, description=bdef.description
            )
            session.add(existing)
            await session.flush()
        out[bdef.code] = existing
    return out


async def evaluate_user(session: AsyncSession, user_id: UUID) -> list[str]:
    """Award all newly-qualifying badges for this user. Returns awarded codes."""
    catalog = await ensure_catalog(session)
    visits: list[datetime] = list(
        (
            await session.scalars(
                select(Visit.entered_at).where(Visit.user_id == user_id)
            )
        ).all()
    )
    if not visits:
        return []

    held = set(
        (
            await session.scalars(
                select(Badge.code)
                .join(UserBadge, UserBadge.badge_id == Badge.id)
                .where(UserBadge.user_id == user_id)
            )
        ).all()
    )

    awarded: list[str] = []
    for bdef in CATALOG:
        if bdef.code in held:
            continue
        try:
            qualifies = bdef.rule(visits)
        except Exception:  # noqa: BLE001 - defensive: don't break recognition
            logger.exception("badge rule %s raised", bdef.code)
            continue
        if qualifies:
            session.add(
                UserBadge(user_id=user_id, badge_id=catalog[bdef.code].id)
            )
            awarded.append(bdef.code)

    if not awarded:
        return []

    await session.commit()
    user = await session.get(User, user_id)
    for code in awarded:
        bdef = _CATALOG_BY_CODE[code]
        await kiosk_manager.broadcast(
            {
                "type": "achievement",
                "user_id": str(user_id),
                "user_name": user.full_name if user else None,
                "badge": {
                    "code": code,
                    "name": bdef.name,
                    "description": bdef.description,
                },
            }
        )
    logger.info("user=%s awarded=%s", user_id, awarded)
    return awarded


async def evaluate_all(session: AsyncSession) -> dict[str, list[str]]:
    """Backfill across all users. Returns {user_id_str: [awarded_codes]}."""
    user_ids = list((await session.scalars(select(User.id))).all())
    out: dict[str, list[str]] = {}
    for uid in user_ids:
        codes = await evaluate_user(session, uid)
        if codes:
            out[str(uid)] = codes
    return out
