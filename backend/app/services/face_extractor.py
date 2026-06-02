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


def get_all_faces(jpeg_bytes: bytes) -> list[dict]:
    """Decode a JPEG frame and return every detected face, largest-first.

    Returns an empty list if the bytes don't decode or no face is found. Each
    box is in the frame's own pixel coordinates so the kiosk can scale it onto
    its preview. Faces are sorted by bounding-box area (descending) so the first
    entry is the closest person::

        [{
          "box": {"x", "y", "w", "h", "frame_w", "frame_h"},
          "embedding": [...512],
          "quality": float,
        }, ...]
    """
    if not jpeg_bytes:
        return []
    arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return []

    app = _load()
    faces = app.get(img)
    if not faces:
        return []

    def area(f) -> float:
        x1, y1, x2, y2 = f.bbox
        return (x2 - x1) * (y2 - y1)

    frame_h, frame_w = img.shape[:2]
    out: list[dict] = []
    for f in sorted(faces, key=area, reverse=True):
        x1, y1, x2, y2 = (float(v) for v in f.bbox)
        out.append(
            {
                "box": {
                    "x": x1,
                    "y": y1,
                    "w": x2 - x1,
                    "h": y2 - y1,
                    "frame_w": int(frame_w),
                    "frame_h": int(frame_h),
                },
                "embedding": f.normed_embedding.astype(float).tolist(),
                "quality": float(getattr(f, "det_score", 0.0)),
            }
        )
    return out


def get_face_values(jpeg_bytes: bytes) -> dict | None:
    """Decode a JPEG frame and return the largest face's box, embedding and quality.

    Thin wrapper over :func:`get_all_faces` for callers that only need the
    closest face. Returns ``None`` if the bytes don't decode or no face is found.
    """
    faces = get_all_faces(jpeg_bytes)
    return faces[0] if faces else None


def extract(jpeg_bytes: bytes) -> tuple[list[float] | None, float | None]:
    """Decode a JPEG frame and return (embedding, quality) for the largest face.

    Thin wrapper over :func:`get_face_values` kept for callers that only need the
    embedding. Returns (None, None) if no face is found.
    """
    values = get_face_values(jpeg_bytes)
    if values is None:
        return None, None
    return values["embedding"], values["quality"]
