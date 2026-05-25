import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws.manager import kiosk_manager

logger = logging.getLogger("ws.kiosk")

router = APIRouter()


@router.websocket("/ws/kiosk")
async def kiosk_ws(ws: WebSocket) -> None:
    """Frontend connects here to receive state pushes and send interactions."""
    await kiosk_manager.connect(ws)
    try:
        # Initial hello so the client knows it's connected.
        await ws.send_json({"type": "state_change", "state": "AMBIENT", "payload": {}})
        while True:
            # Frontend -> backend interactions (key_pressed, form_submit, ...).
            msg = await ws.receive_json()
            logger.info("kiosk interaction: %s", msg.get("type"))
            # Interaction handling is implemented alongside the UI flows.
    except WebSocketDisconnect:
        await kiosk_manager.disconnect(ws)
    except Exception:  # noqa: BLE001
        logger.exception("kiosk ws error")
        await kiosk_manager.disconnect(ws)
