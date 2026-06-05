"""Seed (or clean) demo data so the mock pipeline shows real recognition.

Seed:   docker compose exec backend python -m app.seed
Clean:  docker compose exec backend python -m app.seed clean

The demo user's face embedding is the same deterministic vector the mock
face-service sends as a "returning user", so recognition fires end-to-end.
Seeding is idempotent (won't duplicate the demo user) and is gated behind the
DEMO_MODE flag so the canned demo is enabled/disabled together with the mock
face-service. ``clean`` removes the demo user and everything it owns (visits,
embeddings, reservations, badge links); it runs regardless of DEMO_MODE so you
can always wipe demo data. Reusable badge *definitions* are left in place.
"""
import asyncio
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.core.embedding import demo_known_embedding
from app.models import Badge, FaceEmbedding, Reservation, User, UserBadge, Visit

DEMO_EMAIL = "demo@itu.edu.tr"


async def _get_or_create_badge(session, code: str, name: str, description: str) -> Badge:
    existing = await session.scalar(select(Badge).where(Badge.code == code))
    if existing is not None:
        return existing
    badge = Badge(code=code, name=name, description=description)
    session.add(badge)
    await session.flush()
    return badge


async def seed() -> None:
    if not settings.demo_mode:
        print("DEMO_MODE is off; refusing to seed. Set DEMO_MODE=true to enable the demo.")
        return
    async with AsyncSessionLocal() as session:
        existing = await session.scalar(select(User).where(User.email == DEMO_EMAIL))
        if existing is not None:
            print(f"demo user already exists ({existing.id}); skipping")
            return

        now = datetime.now(timezone.utc)

        demo = User(
            full_name="Demo Kullanıcı",
            email=DEMO_EMAIL,
            role="researcher",
            interests=["LLM", "RAG"],
            bio="Mock tanıma için demo kullanıcı.",
            kvkk_consented_at=now,
            email_verified_at=now,
        )
        session.add(demo)
        await session.flush()

        session.add(
            FaceEmbedding(
                user_id=demo.id,
                embedding=demo_known_embedding(),
                quality_score=0.95,
                source="admin",
            )
        )

        # A few past visits so the leaderboard/greeting have numbers.
        for i in range(1, 6):
            session.add(
                Visit(user_id=demo.id, entered_at=now - timedelta(days=i))
            )

        # Reservation active right now.
        session.add(
            Reservation(
                user_id=demo.id,
                resource_name="A100-2",
                starts_at=now - timedelta(hours=1),
                ends_at=now + timedelta(hours=2),
            )
        )

        # Badges (get-or-create so re-seeding after a delete is idempotent).
        night_owl = await _get_or_create_badge(
            session, "night_owl", "Gece Kuşu", "Gece çalışan"
        )
        await _get_or_create_badge(session, "streak_7", "7 Gün Seri", "7 gün üst üste")
        await session.flush()
        session.add(UserBadge(user_id=demo.id, badge_id=night_owl.id))

        await session.commit()
        print(f"seeded demo user {demo.id} with known embedding, 5 visits, 1 reservation, 1 badge")


async def clean() -> None:
    """Remove the demo user and every row it owns. Badge definitions stay."""
    async with AsyncSessionLocal() as session:
        user_id = await session.scalar(
            select(User.id).where(User.email == DEMO_EMAIL)
        )
        if user_id is None:
            print("no demo user found; nothing to clean")
            return
        # Explicit child deletes (in FK order) so this works whether or not the
        # DB has ON DELETE CASCADE wired up.
        for model in (UserBadge, Reservation, Visit, FaceEmbedding):
            await session.execute(delete(model).where(model.user_id == user_id))
        await session.execute(delete(User).where(User.id == user_id))
        await session.commit()
        print(
            f"cleaned demo user {user_id} (+ its visits, embeddings, reservations, badge links)"
        )


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "seed"
    if command == "clean":
        asyncio.run(clean())
    elif command == "seed":
        asyncio.run(seed())
    else:
        print(f"usage: python -m app.seed [seed|clean] (got {command!r})")
        sys.exit(2)
