"""Browser → backend frame ingest.

The kiosk browser captures camera frames (getUserMedia) and sends JPEGs as
binary WebSocket messages. The backend extracts an embedding via InsightFace
and feeds it into the existing recognition pipeline.
"""
import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import face_extractor
from app.services.recognition import handle_face_event

logger = logging.getLogger("ws.frames")

router = APIRouter()


@router.websocket("/ws/frames")
async def frames_ws(ws: WebSocket) -> None:
    await ws.accept()
    logger.info("camera client connected")
    consecutive_empty = 0
    try:
        while True:
            data = await ws.receive_bytes()
            embedding, quality = await asyncio.to_thread(
                face_extractor.extract, data
            )
            if embedding is None:
                consecutive_empty += 1
                # Emit face_lost only once when we transition from "seeing" to "empty"
                # — every 3 empty frames is enough.
                if consecutive_empty == 3:
                    await handle_face_event({"type": "face_lost"})
            else:
                consecutive_empty = 0
                await handle_face_event(
                    {"type": "face_frame", "embedding": embedding, "quality": quality}
                )
    except WebSocketDisconnect:
        logger.info("camera client disconnected")
    except Exception:  # noqa: BLE001
        logger.exception("frames ws error")
