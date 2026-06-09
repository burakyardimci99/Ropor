import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core import reservation_db
from app.core.config import settings
from app.core.redis import redis_client
from app.services import face_extractor, klab_enrollment
from app.ws import face_service, frames, kiosk
from app.ws.manager import kiosk_manager

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("app")


async def _refresh_klab_index() -> None:
    """Periodically rebuild the klab auto-enrollment candidate list.

    Auto-enrollment matches an unknown live face against embeddings built from
    klab users' profile photos. Those photos are uploaded to klab over time, so
    a one-shot build at startup would quickly go stale — instead we rebuild the
    in-memory list every ``klab_enroll_refresh_seconds``.

    This runs as a long-lived background task for the whole app lifetime. We
    swallow and log any error (a transient klab DB outage, a corrupt photo)
    rather than letting it kill the loop, so one bad refresh never stops future
    ones. ``refresh_index`` itself is a no-op when the integration is disabled.
    """
    while True:
        try:
            await klab_enrollment.refresh_index()
        except Exception:  # noqa: BLE001
            logger.exception("klab index refresh failed")
        await asyncio.sleep(settings.klab_enroll_refresh_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    try:
        await redis_client.ping()
        logger.info("redis connected")
    except Exception:  # noqa: BLE001
        logger.warning("redis not reachable at startup")

    # Warm the face model in a background thread so the first /ws/frames
    # message doesn't pay the ~3-5s load cost.
    if settings.face_extractor_eager_warm:
        asyncio.create_task(asyncio.to_thread(face_extractor.warm))

    # Start the klab auto-enrollment refresher only when the feature is enabled
    # *and* a klab database URL is configured; otherwise there is nothing to
    # index and we keep the task from spinning needlessly. We hold the handle so
    # we can cancel it cleanly on shutdown.
    klab_task: asyncio.Task | None = None
    if settings.klab_enroll_enabled and reservation_db.is_configured():
        klab_task = asyncio.create_task(_refresh_klab_index())

    yield

    # --- shutdown ---
    # Stop the background refresher (if it was started) before closing Redis, so
    # the loop doesn't run against torn-down resources.
    if klab_task is not None:
        klab_task.cancel()
    await redis_client.aclose()


app = FastAPI(
    title="AI Lab Giriş Sistemi — Backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    # Dev convenience: allow any localhost port (kiosk + preview servers).
    allow_origin_regex=r"https?://localhost(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(face_service.router)
app.include_router(kiosk.router)
app.include_router(frames.router)


@app.get("/health", tags=["meta"])
async def health() -> dict:
    redis_ok = False
    try:
        redis_ok = await redis_client.ping()
    except Exception:  # noqa: BLE001
        redis_ok = False
    return {
        "status": "ok",
        "redis": redis_ok,
        "kiosk_clients": kiosk_manager.client_count,
    }
