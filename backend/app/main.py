import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import settings
from app.core.redis import redis_client
from app.services import face_extractor
from app.ws import face_service, frames, kiosk
from app.ws.manager import kiosk_manager

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await redis_client.ping()
        logger.info("redis connected")
    except Exception:  # noqa: BLE001
        logger.warning("redis not reachable at startup")

    # Warm the face model in a background thread so the first /ws/frames
    # message doesn't pay the ~3-5s load cost.
    if settings.face_extractor_eager_warm:
        import asyncio

        asyncio.create_task(asyncio.to_thread(face_extractor.warm))

    yield
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
