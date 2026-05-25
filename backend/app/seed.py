"""Seed demo data so the mock pipeline shows real recognition.

Run:  docker compose exec backend python -m app.seed

The demo user's face embedding is the same deterministic vector the mock
face-service sends as a "returning user", so recognition fires end-to-end.
Idempotent: re-running won't duplicate the demo user.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

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


if __name__ == "__main__":
    asyncio.run(seed())
