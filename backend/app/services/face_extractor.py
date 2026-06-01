"""Real face detection + embedding from a JPEG frame, using InsightFace buffalo_l.

The model is loaded once (lazy) and reused across requests. Decoding + inference
run on a worker thread so they don't block the asyncio event loop.
"""
import logging
import threading

import cv2
import numpy as np

logger = logging.getLogger("services.face_extractor")

_lock = threading.Lock()
_app = None  # FaceAnalysis instance


def _load():
    """Load the buffalo_l detector + ArcFace embedder. Heavy; call once."""
    global _app
    if _app is not None:
        return _app
    with _lock:
        if _app is not None:
            return _app
        from insightface.app import FaceAnalysis  # local import: heavy

        logger.info("loading InsightFace buffalo_l (this may take a few seconds)...")
        a = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        a.prepare(ctx_id=-1, det_size=(640, 640))
        _app = a
        logger.info("InsightFace ready")
    return _app


def warm() -> None:
    """Eagerly load the model (e.g., at app startup) to avoid first-call latency."""
    _load()


def extract(jpeg_bytes: bytes) -> tuple[list[float] | None, float | None]:
    """Decode a JPEG frame and return (embedding, quality) for the largest face.

    Returns (None, None) if the bytes don't decode or no face is found.
    """
    if not jpeg_bytes:
        return None, None
    arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None, None

    app = _load()
    faces = app.get(img)
    if not faces:
        return None, None

    # Pick the largest face by bounding-box area.
    def area(f) -> float:
        x1, y1, x2, y2 = f.bbox
        return (x2 - x1) * (y2 - y1)

    f = max(faces, key=area)
    emb = f.normed_embedding.astype(float).tolist()
    quality = float(getattr(f, "det_score", 0.0))
    return emb, quality
