import asyncio
import json
import logging
import threading

import websockets

from app.config import config
from app.recognizer import build_recognizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("face-service")


def _start_producer(recognizer, queue: asyncio.Queue, loop: asyncio.AbstractEventLoop) -> None:
    """Run the (blocking) recognizer generator in a thread, feed the queue."""

    def producer() -> None:
        for event in recognizer.events():
            asyncio.run_coroutine_threadsafe(queue.put(event), loop)

    threading.Thread(target=producer, daemon=True, name="recognizer").start()


async def run() -> None:
    logger.info("face-service starting in %s mode", config.mode)
    recognizer = build_recognizer(
        config.mode,
        config.embedding_dim,
        config.mock_event_interval_s,
        config.mock_known_ratio,
    )
    queue: asyncio.Queue = asyncio.Queue()
    _start_producer(recognizer, queue, asyncio.get_running_loop())

    backoff = 1
    while True:
        try:
            async with websockets.connect(config.backend_ws_url) as ws:
                logger.info("connected to backend at %s", config.backend_ws_url)
                backoff = 1
                while True:
                    event = await queue.get()
                    await ws.send(json.dumps(event.to_message()))
                    logger.info("sent %s", event.type)
        except (OSError, websockets.exceptions.WebSocketException) as exc:
            logger.warning("backend connection failed (%s); retry in %ds", exc, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30)


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        logger.info("face-service stopped")
