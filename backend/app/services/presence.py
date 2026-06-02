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
