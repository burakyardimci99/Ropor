"""Auto-enrollment from klab profile photos.

When a live face is unknown to ailab, we match it against embeddings built from
klab users' profile photos. On a confident match we create the ailab user on the
fly (name/email copied from klab) and let the normal greeting flow take over —
the person never sees the self-service registration screen.

The candidate list lives in memory and is rebuilt periodically (profile photos
are uploaded over time). Building an embedding runs InsightFace, which is
CPU-heavy, so the rebuild happens off the event loop.
"""
import asyncio
import base64
import binascii
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import reservation_db
from app.core.config import settings
from app.models import FaceEmbedding, User
from app.services import face_extractor

logger = logging.getLogger("services.klab_enrollment")


@dataclass
class Candidate:
    klab_id: str
    email: str
    full_name: str
    embedding: np.ndarray  # L2-normalized, 512-dim


_candidates: list[Candidate] = []
_refresh_lock = asyncio.Lock()


def _normalize(vec) -> np.ndarray:
    arr = np.asarray(vec, dtype=np.float32)
    return arr / (float(np.linalg.norm(arr)) or 1.0)


def _photo_to_embedding(value: str) -> list[float] | None:
    """Decode a base64 profile photo and return its largest face embedding.

    Runs InsightFace — call from a worker thread, not the event loop. Returns
    None when the photo can't be decoded or has no detectable face.
    """
    if not value:
        return None
    # Drop an optional data-URI prefix: "data:image/jpeg;base64,...."
    if value.startswith("data:"):
        value = value.split(",", 1)[-1]
    try:
        raw = base64.b64decode(value, validate=False)
    except (binascii.Error, ValueError):
        return None
    face = face_extractor.get_face_values(raw)
    return face["embedding"] if face else None


async def _fetch_rows() -> list[dict]:
    """Read klab users that have a profile photo (skipping deleted, status=3)."""
    sm = reservation_db.session()
    if sm is None:
        return []
    stmt = text(
        "SELECT id, email, full_name, profile_photo FROM users "
        "WHERE status <> 3 AND profile_photo IS NOT NULL AND profile_photo <> ''"
    )
    async with sm as s:
        result = await s.execute(stmt)
        return [dict(r) for r in result.mappings().all()]


async def refresh_index() -> int:
    """Rebuild the in-memory candidate list from klab profile photos.

    Returns the number of candidates indexed. Rows whose photo can't be decoded
    or has no detectable face are skipped.
    """
    if not (settings.klab_enroll_enabled and reservation_db.is_configured()):
        return 0
    async with _refresh_lock:
        rows = await _fetch_rows()
        candidates: list[Candidate] = []
        for row in rows:
            emb = await asyncio.to_thread(_photo_to_embedding, row["profile_photo"])
            if emb is None:
                continue
            candidates.append(
                Candidate(
                    klab_id=str(row["id"]),
                    email=row["email"],
                    full_name=row["full_name"],
                    embedding=_normalize(emb),
                )
            )
        global _candidates
        _candidates = candidates
        logger.info("klab candidate index built: %d candidates", len(candidates))
        return len(candidates)


def find_candidate(embedding: list[float]) -> tuple[Candidate, float] | None:
    """Closest klab candidate to a live embedding by cosine similarity.

    Returns ``(candidate, similarity)`` or None when the list is empty. The
    threshold check is left to the caller.
    """
    q = _normalize(embedding)
    best: Candidate | None = None
    best_sim = -1.0
    for cand in _candidates:
        sim = float(q @ cand.embedding)
        if sim > best_sim:
            best, best_sim = cand, sim
    return (best, best_sim) if best is not None else None


async def auto_enroll(
    session: AsyncSession,
    candidate: Candidate,
    live_embedding: list[float],
    quality: float | None,
) -> User:
    """Create (or reuse) the ailab user for a matched klab candidate and commit.

    Stores the *live* embedding so future frames match through the normal
    pipeline. If a user with the same email already exists we attach the
    embedding to them instead of creating a duplicate (email links klab<->ailab).
    """
    user = await session.scalar(select(User).where(User.email == candidate.email))
    if user is None:
        user = User(
            full_name=candidate.full_name,
            email=candidate.email,
            role=settings.klab_enroll_default_role,
            interests=[],
            # Consent is delegated to klab (the photo was uploaded there); we
            # record the enrollment moment for provenance.
            kvkk_consented_at=datetime.now(timezone.utc),
        )
        session.add(user)
        await session.flush()  # assigns user.id
        logger.info("auto-enrolled new ailab user from klab %s", candidate.klab_id)
    else:
        logger.info("klab match for existing user %s; attaching embedding", user.id)

    session.add(
        FaceEmbedding(
            user_id=user.id,
            embedding=live_embedding,
            quality_score=quality,
            source="auto_enrolled",
        )
    )
    await session.commit()
    await session.refresh(user)
    return user
