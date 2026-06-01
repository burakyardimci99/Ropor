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
from app.services import badges, presence
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

    fresh_visit_id: str | None = None
    if await presence.should_record_visit(user_id):
        visit = Visit(user_id=user_id, detection_confidence=similarity)
        session.add(visit)
        await session.commit()
        await session.refresh(visit)
        fresh_visit_id = str(visit.id)
        logger.info("recorded visit for %s (sim=%.3f)", user_id, similarity)
        # Evaluate badges in the background so we don't delay the greeting.
        # `evaluate_user` commits its own session changes and broadcasts the
        # achievement event itself.
        try:
            await badges.evaluate_user(session, user_id)
        except Exception:  # noqa: BLE001
            logger.exception("badge evaluation failed for %s", user_id)

    await presence.mark_inside(user_id, greeting["user"])

    payload = {**greeting, "confidence": round(similarity, 3)}
    # Only sent when a brand-new visit row was created — the kiosk uses this
    # to know whether to prompt for daily_intent (otherwise a busy lab would
    # nag the same person every recognition cycle).
    if fresh_visit_id is not None:
        payload["visit_id"] = fresh_visit_id
    await kiosk_manager.broadcast(
        {"type": "state_change", "state": "GREETING", "payload": payload}
    )
