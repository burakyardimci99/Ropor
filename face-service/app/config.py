import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Config:
    mode: str = os.getenv("FACE_SERVICE_MODE", "mock")  # mock | insightface
    backend_ws_url: str = os.getenv(
        "BACKEND_WS_URL", "ws://backend:8000/ws/face-service"
    )
    camera_source: str = os.getenv("CAMERA_SOURCE", "0")
    frame_interval_ms: int = int(os.getenv("FRAME_INTERVAL_MS", "200"))
    mock_event_interval_s: float = float(os.getenv("MOCK_EVENT_INTERVAL_S", "8"))
    # Probability a mock visit is a "returning" (recognized) user vs unknown.
    mock_known_ratio: float = float(os.getenv("MOCK_KNOWN_RATIO", "0.5"))
    embedding_dim: int = 512


config = Config()
