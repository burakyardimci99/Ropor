"""Redis-backed transient state: visit debounce, presence, unknown-face handoff.

None of this is durable: presence keys expire so "currently inside" reflects
recent detections, and unknown-face embeddings are cached only long enough for
the kiosk to start an onboarding/visitor flow (KVKK data minimization — no DB
row is written for people who just walk past).
"""
import json
import uuid
from uuid import UUID

from app.core.config import settings
from app.core.redis import redis_client

VISIT_DEBOUNCE_TTL = settings.visit_debounce_minutes * 60
GREET_COOLDOWN_TTL = settings.greet_cooldown_seconds
PRESENCE_TTL = 300  # 5 min FOV window for "currently inside"
UNKNOWN_EMB_TTL = 300
CONFIRM_WINDOW_TTL = settings.face_confirm_window_seconds
UNKNOWN_SEEN_KEY = "unknown_seen"


async def should_record_visit(user_id: UUID) -> bool:
    """True the first time within the debounce window; refreshes the window."""
    key = f"visit_seen:{user_id}"
    was_set = await redis_client.set(key, "1", ex=VISIT_DEBOUNCE_TTL, nx=True)
    if was_set:
        return True
    await redis_client.expire(key, VISIT_DEBOUNCE_TTL)
    return False


async def should_greet(user_id: UUID) -> bool:
    """True once per greet-cooldown window for a user.

    The face service streams frames continuously while someone stands in front
    of the camera. Without this gate the backend would broadcast a GREETING on
    every frame and the kiosk would never leave the welcome screen. Unlike the
    visit debounce, the window is NOT refreshed on each frame: it expires on its
    own, so a person who genuinely leaves and returns later is greeted again.
    """
    key = f"greeted:{user_id}"
    was_set = await redis_client.set(key, "1", ex=GREET_COOLDOWN_TTL, nx=True)
    return bool(was_set)


async def bump_seen(user_id: UUID) -> int:
    """Count consecutive frames a known face has been seen; return the new total.

    Each call increments a short-lived per-user counter and refreshes its TTL.
    When the face leaves the frame the counter expires on its own, so a fresh
    arrival starts counting from 1 again. The recognition pipeline only greets
    once this crosses ``face_confirm_frames``.
    """
    key = f"seen:{user_id}"
    count = await redis_client.incr(key)
    await redis_client.expire(key, CONFIRM_WINDOW_TTL)
    return count


async def bump_unknown_seen() -> int:
    """Count consecutive frames an unknown face has driven the screen.

    Mirrors :func:`bump_seen` for the no-identity case: a stranger standing in
    front of the camera produces consecutive unknown frames, and we only switch
    to the registration screen once this crosses ``unknown_confirm_frames``.
    """
    count = await redis_client.incr(UNKNOWN_SEEN_KEY)
    await redis_client.expire(UNKNOWN_SEEN_KEY, CONFIRM_WINDOW_TTL)
    return count


async def reset_unknown_seen() -> None:
    """Drop the unknown streak (e.g. once a known face takes over the screen)."""
    await redis_client.delete(UNKNOWN_SEEN_KEY)


async def clear_confirmations() -> None:
    """Reset all frame-confirmation counters — called when the face is lost."""
    await redis_client.delete(UNKNOWN_SEEN_KEY)
    async for key in redis_client.scan_iter(match="seen:*"):
        await redis_client.delete(key)


async def mark_inside(user_id: UUID, mini: dict) -> None:
    await redis_client.set(f"inside:{user_id}", json.dumps(mini), ex=PRESENCE_TTL)


async def list_inside() -> list[dict]:
    out: list[dict] = []
    async for key in redis_client.scan_iter(match="inside:*"):
        raw = await redis_client.get(key)
        if raw:
            out.append(json.loads(raw))
    return out


async def cache_unknown_embedding(embedding: list[float]) -> str:
    ref = f"unk-{uuid.uuid4()}"
    await redis_client.set(
        f"unknown_emb:{ref}", json.dumps(embedding), ex=UNKNOWN_EMB_TTL
    )
    return ref


async def get_unknown_embedding(ref: str) -> list[float] | None:
    raw = await redis_client.get(f"unknown_emb:{ref}")
    return json.loads(raw) if raw else None
