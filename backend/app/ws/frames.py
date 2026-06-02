"""Browser → backend frame ingest, with a face box + name echoed back.

The kiosk browser captures camera frames (getUserMedia) and streams them as
binary JPEG WebSocket messages. For every frame the backend:

  1. detects the largest face and reads its box + embedding (InsightFace),
  2. runs that embedding through the recognition pipeline to get the
     recognized full name (or ``None`` when the face is unknown),
  3. echoes ``{"type": "face_box", "box": ..., "name": ...}`` back over the
     same socket.

The kiosk preview (``CameraPreview.tsx``) consumes that payload and draws the
square + name label itself, scaled onto the live video. When no face is in
view the backend echoes ``box: null`` so the kiosk clears its overlay, and
emits a one-off ``face_lost`` after a short gap to drop back to ambient.
"""
import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import face_extractor
from app.services.recognition import handle_face_event, handle_frame_faces

logger = logging.getLogger("ws.frames")

router = APIRouter()

# Consecutive empty frames before we treat the face as "gone". At ~2 frames/sec
# this is roughly 1.5s of nobody in view.
EMPTY_FRAMES_BEFORE_LOST = 3


def get_face_box_payload(box: dict | None, name: str | None) -> dict:
    """Build the ``face_box`` message the kiosk preview draws from.

    ``box`` is the detected face's pixel rectangle (``None`` when no face is in
    view → kiosk clears its overlay); ``name`` is the recognized full name
    (``None`` when the face is unknown → kiosk labels it "Bilinmiyor").
    """
    return {"type": "face_box", "box": box, "name": name}


def get_detected_faces(jpeg_bytes: bytes) -> list[dict]:
    """Detect every face in a JPEG frame; return their boxes/embeddings/quality.

    Returns an empty list when the bytes don't decode or no face is found, and
    is ordered largest-first so the closest person leads. Detection + embedding
    are CPU-heavy, so callers should run this off the event loop.
    """
    return face_extractor.get_all_faces(jpeg_bytes)


async def get_recognized_name(faces: list[dict]) -> str | None:
    """Run all detected faces through recognition; return the closest's name.

    Returns the closest (driver) face's recognized full name, or ``None`` when
    it is unknown. Side effect: recognition records every face's visit and may
    broadcast a kiosk state change (greeting / registration) for the driver.
    """
    return await handle_frame_faces(faces)


@router.websocket("/ws/frames")
async def frames_ws(ws: WebSocket) -> None:
    await ws.accept()
    logger.info("camera client connected")
    consecutive_empty = 0
    try:
        while True:
            data = await ws.receive_bytes()

            # Detection + embedding are CPU-heavy → run off the event loop.
            faces = await asyncio.to_thread(get_detected_faces, data)

            if not faces:
                consecutive_empty += 1
                # Clear the kiosk overlay immediately on the first empty frame.
                if consecutive_empty == 1:
                    await ws.send_json(get_face_box_payload(None, None))
                # Drop back to ambient once, after a short gap.
                if consecutive_empty == EMPTY_FRAMES_BEFORE_LOST:
                    await handle_face_event({"type": "face_lost"})
                continue

            consecutive_empty = 0
            # Recognition evaluates every face; the preview labels the closest.
            name = await get_recognized_name(faces)
            await ws.send_json(get_face_box_payload(faces[0]["box"], name))
    except WebSocketDisconnect:
        logger.info("camera client disconnected")
    except Exception:  # noqa: BLE001
        logger.exception("frames ws error")
