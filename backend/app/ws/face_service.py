import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.recognition import handle_face_event

logger = logging.getLogger("ws.face_service")

router = APIRouter()


@router.websocket("/ws/face-service")
async def face_service_ws(ws: WebSocket) -> None:
    """Ingest endpoint the face-service connects to and pushes face events on."""
    await ws.accept()
    logger.info("face-service connected")
    try:
        while True:
            event = await ws.receive_json()
            await handle_face_event(event)
    except WebSocketDisconnect:
        logger.info("face-service disconnected")
    except Exception:  # noqa: BLE001
        logger.exception("face-service ws error")
