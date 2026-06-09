"""Processes face-service events: matches embeddings, records visits, and
broadcasts kiosk state transitions.

Contract (face-service -> backend):
  {"type": "face_frame", "embedding": [...512], "quality": 0.9}
  {"type": "face_lost"}

A single frame can contain several faces. ``handle_frame_faces`` evaluates all
of them: the largest (closest) face "drives" the kiosk screen, while the rest
only get their visit/presence recorded. To filter single-frame false matches we
require a face to be seen across several consecutive frames before acting — a
recognized face is greeted after ``face_confirm_frames`` and at most once per
``greet_cooldown_seconds`` window, while an unrecognized face switches the kiosk
to the registration screen after ``unknown_confirm_frames``.
"""
import logging
from typing import Any

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.models import User, Visit
from app.services import badges, klab_enrollment, presence
from app.services.greeting import build_greeting
from app.services.matching import find_nearest
from app.ws.manager import kiosk_manager

logger = logging.getLogger("services.recognition")


async def handle_face_event(event: dict[str, Any]) -> str | None:
    """Process a single-face event and return the recognized full name, if any.

    Used by the face-service ingest (one embedding per message). The name is
    used to label the live face box; ``None`` means the face was unknown or the
    event wasn't a frame.
    """
    event_type = event.get("type")
    if event_type == "face_frame":
        embedding = event.get("embedding")
        if not isinstance(embedding, list):
            logger.warning("face_frame missing embedding")
            return None
        name, _ = await _process_face(embedding, event.get("quality"), drive_screen=True)
        return name
    elif event_type == "face_lost":
        await presence.clear_confirmations()
        await kiosk_manager.broadcast(
            {"type": "state_change", "state": "AMBIENT", "payload": {}}
        )
        return None
    else:
        logger.warning("unknown face event type: %r", event_type)
        return None


async def handle_frame_faces(faces: list[dict[str, Any]]) -> str | None:
    """Evaluate every face in a camera frame; return the driver's matched name.

    ``faces`` is ordered largest-first. The first (closest) face drives the
    kiosk screen — greeting or registration — while the others only have their
    visit and presence recorded. The returned name labels the preview box drawn
    over that driver face.
    """
    if not faces:
        return None
    driver, *rest = faces
    name, _ = await _process_face(
        driver["embedding"], driver.get("quality"), drive_screen=True
    )
    for face in rest:
        await _process_face(face["embedding"], face.get("quality"), drive_screen=False)
    return name


async def _process_face(
    embedding: list[float], quality, *, drive_screen: bool
) -> tuple[str | None, str]:
    """Match one face and apply its side effects.

    ``drive_screen`` is True only for the closest face in a frame — that one may
    trigger a kiosk state change (greeting / registration). Other faces still
    record their visit and presence but never move the screen. Returns
    ``(recognized_name, status)`` where status is ``"known"`` or ``"unknown"``.
    """
    async with AsyncSessionLocal() as session:
        match = await find_nearest(session, embedding)

        if match.user_id is not None and match.similarity >= settings.face_match_threshold:
            name = await _on_recognized(
                session, match.user_id, match.similarity, quality, drive_screen
            )
            return name, "known"

    if drive_screen:
        await _on_unknown(embedding, quality, match.similarity)
    return None, "unknown"


async def _on_recognized(
    session, user_id, similarity: float, quality, drive_screen: bool
) -> str | None:
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        return None

    # Cheap presence mini — refreshed every frame so "currently inside" stays
    # accurate even while we suppress repeated greetings below.
    mini = {
        "id": str(user.id),
        "full_name": user.full_name,
        "role": user.role,
        "interests": user.interests,
        "avatar_url": user.avatar_url,
    }

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

    await presence.mark_inside(user_id, mini)

    # Only the closest face moves the screen; the rest are just recorded above.
    if not drive_screen:
        return user.full_name

    # A known face is on screen, so any unknown streak is stale — drop it.
    await presence.reset_unknown_seen()

    # Require a few consecutive frames before greeting, to filter out a stray
    # single-frame false match.
    if await presence.bump_seen(user_id) < settings.face_confirm_frames:
        return user.full_name

    # Greet at most once per cooldown window: if this face already entered
    # within the last `greet_cooldown_seconds`, stay silent. The face service
    # streams frames continuously, so without this the welcome screen would be
    # re-broadcast every frame and never time out back to ambient.
    if not await presence.should_greet(user_id):
        return user.full_name

    greeting = await build_greeting(session, user_id)
    if greeting is None:
        return user.full_name

    payload = {**greeting, "confidence": round(similarity, 3)}
    # Only sent when a brand-new visit row was created — the kiosk uses this
    # to know whether to prompt for daily_intent (otherwise a busy lab would
    # nag the same person every recognition cycle).
    if fresh_visit_id is not None:
        payload["visit_id"] = fresh_visit_id
    await kiosk_manager.broadcast(
        {"type": "state_change", "state": "GREETING", "payload": payload}
    )
    return user.full_name


async def _on_unknown(embedding: list[float], quality, similarity: float) -> None:
    """Count consecutive unknown frames; open registration once confirmed.

    Fires exactly once when the streak first reaches ``unknown_confirm_frames``
    (the kiosk ignores repeats while already on the registration screen). The
    streak resets via TTL when the person leaves, or explicitly on ``face_lost``.
    """
    seen = await presence.bump_unknown_seen()
    if seen != settings.unknown_confirm_frames:
        return

    # First try to recognize them from a klab profile photo and auto-enroll.
    # Only if that misses do we fall back to self-service onboarding.
    if await _try_klab_enroll(embedding, quality):
        return

    # Confirmed unknown -> stash embedding so the kiosk can start onboarding.
    ref = await presence.cache_unknown_embedding(embedding)
    logger.info(
        "unknown face confirmed after %d frames (best sim=%.3f) -> ref %s",
        seen,
        similarity,
        ref,
    )
    await kiosk_manager.broadcast(
        {
            "type": "state_change",
            "state": "UNKNOWN_PROMPT",
            "payload": {"embedding_ref": ref, "quality": quality},
        }
    )


async def _try_klab_enroll(embedding: list[float], quality) -> bool:
    """Auto-enroll a confirmed-unknown face from a klab profile photo.

    Returns True when the face matched a klab candidate above
    ``klab_enroll_threshold`` and was enrolled + greeted (so the caller skips the
    onboarding prompt). The stored embedding is the live one, so subsequent
    frames recognize this person through the normal pipeline.
    """
    if not settings.klab_enroll_enabled:
        return False

    match = klab_enrollment.find_candidate(embedding)
    if match is None:
        return False
    candidate, similarity = match
    if similarity < settings.klab_enroll_threshold:
        return False

    async with AsyncSessionLocal() as session:
        user = await klab_enrollment.auto_enroll(session, candidate, embedding, quality)

        fresh_visit_id: str | None = None
        if await presence.should_record_visit(user.id):
            visit = Visit(user_id=user.id, detection_confidence=round(similarity, 3))
            session.add(visit)
            await session.commit()
            await session.refresh(visit)
            fresh_visit_id = str(visit.id)

        greeting = await build_greeting(session, user.id)
        mini = {
            "id": str(user.id),
            "full_name": user.full_name,
            "role": user.role,
            "interests": user.interests,
            "avatar_url": user.avatar_url,
        }

    logger.info("auto-enrolled %s from klab (sim=%.3f)", user.id, similarity)

    # A known face now owns the screen: drop the unknown streak, mark presence,
    # and arm the greet cooldown so it isn't re-greeted every frame.
    await presence.reset_unknown_seen()
    await presence.mark_inside(user.id, mini)
    await presence.should_greet(user.id)

    if greeting is None:
        return True

    payload = {**greeting, "confidence": round(similarity, 3), "auto_enrolled": True}
    if fresh_visit_id is not None:
        payload["visit_id"] = fresh_visit_id
    await kiosk_manager.broadcast(
        {"type": "state_change", "state": "GREETING", "payload": payload}
    )
    return True
