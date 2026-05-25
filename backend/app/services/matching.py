"""Nearest-neighbour face matching against stored embeddings via pgvector."""
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FaceEmbedding


@dataclass
class MatchResult:
    user_id: UUID | None
    similarity: float  # cosine similarity in [-1, 1]; higher = closer


async def find_nearest(session: AsyncSession, embedding: list[float]) -> MatchResult:
    distance = FaceEmbedding.embedding.cosine_distance(embedding)
    stmt = (
        select(FaceEmbedding.user_id, distance.label("distance"))
        .order_by(distance)
        .limit(1)
    )
    row = (await session.execute(stmt)).first()
    if row is None:
        return MatchResult(user_id=None, similarity=-1.0)
    user_id, dist = row
    return MatchResult(user_id=user_id, similarity=1.0 - float(dist))
