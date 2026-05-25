"""Processes face-service events: matches embeddings, records visits, and
broadcasts kiosk state transitions.

Contract (face-service -> backend):
  {"type": "face_frame", "embedding": [...512], "quality": 0.9}
  {"type": "face_lost"}
"""
import logging
from typing import Any

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.models import Visit
from app.services import presence
from app.services.greeting import build_greeting
from app.services.matching import find_nearest
from app.ws.manager import kiosk_manager

logger = logging.getLogger("services.recognition")


async def handle_face_event(event: dict[str, Any]) -> None:
    event_type = event.get("type")
    if event_type == "face_frame":
        await _handle_frame(event)
    elif event_type == "face_lost":
        await kiosk_manager.broadcast(
            {"type": "state_change", "state": "AMBIENT", "payload": {}}
        )
    else:
        logger.warning("unknown face event type: %r", event_type)


async def _handle_frame(event: dict[str, Any]) -> None:
    embedding = event.get("embedding")
    if not isinstance(embedding, list):
        logger.warning("face_frame missing embedding")
        return
    quality = event.get("quality")

    async with AsyncSessionLocal() as session:
        match = await find_nearest(session, embedding)

        if match.user_id is not None and match.similarity >= settings.face_match_threshold:
            await _on_recognized(session, match.user_id, match.similarity, quality)
            return

    # Not recognized -> stash embedding so the kiosk can start onboarding/visitor.
    ref = await presence.cache_unknown_embedding(embedding)
    logger.info("unknown face (best sim=%.3f) -> ref %s", match.similarity, ref)
    await kiosk_manager.broadcast(
        {
            "type": "state_change",
            "state": "UNKNOWN_PROMPT",
            "payload": {"embedding_ref": ref, "quality": quality},
        }
    )


async def _on_recognized(session, user_id, similarity: float, quality) -> None:
    greeting = await build_greeting(session, user_id)
    if greeting is None:
        return

    if await presence.should_record_visit(user_id):
        session.add(
            Visit(user_id=user_id, detection_confidence=similarity)
        )
        await session.commit()
        logger.info("recorded visit for %s (sim=%.3f)", user_id, similarity)

    await presence.mark_inside(user_id, greeting["user"])

    payload = {**greeting, "confidence": round(similarity, 3)}
    await kiosk_manager.broadcast(
        {"type": "state_change", "state": "GREETING", "payload": payload}
    )
