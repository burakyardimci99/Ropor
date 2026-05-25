"""Face recognition abstraction.

`Recognizer` defines the interface the rest of the service depends on. The
mock implementation fabricates frames/embeddings so the full UI pipeline can
be exercised without a camera or GPU. The real InsightFace implementation is
stubbed and gets filled in during the InsightFace phase.

Contract emitted to the backend:
    face_frame {embedding: [...512], quality: float}   # a face is present
    face_lost  {}                                       # field of view cleared

The backend does the actual nearest-neighbour matching, so the mock just needs
to send embeddings. To make demo recognition work, it sends a deterministic
"known" vector part of the time (matching the seeded demo user) and random
vectors otherwise (which the backend treats as unknown).
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Iterator, Protocol

import numpy as np

EMBEDDING_DIM = 512


@dataclass
class FaceEvent:
    type: str
    payload: dict

    def to_message(self) -> dict:
        return {"type": self.type, **self.payload}


class Recognizer(Protocol):
    def events(self) -> Iterator[FaceEvent]:
        """Yield face events as they occur (blocking generator)."""
        ...


def demo_known_embedding(seed: int = 42, dim: int = EMBEDDING_DIM) -> list[float]:
    """Deterministic vector — MUST match backend app/core/embedding.py."""
    rng = random.Random(seed)
    vec = [rng.gauss(0.0, 1.0) for _ in range(dim)]
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def _random_embedding(dim: int) -> list[float]:
    vec = np.random.randn(dim).astype(np.float32)
    vec /= np.linalg.norm(vec) + 1e-9
    return vec.tolist()


class MockRecognizer:
    """Simulates people arriving and leaving the camera's field of view."""

    def __init__(self, dim: int, interval_s: float, known_ratio: float = 0.5) -> None:
        self.dim = dim
        self.interval_s = interval_s
        self.known_ratio = known_ratio
        self._known = demo_known_embedding(dim=dim)

    def _one_visit(self) -> list[FaceEvent]:
        returning = random.random() < self.known_ratio
        embedding = self._known if returning else _random_embedding(self.dim)
        quality = round(random.uniform(0.6, 0.95), 3)
        return [
            FaceEvent("face_frame", {"embedding": embedding, "quality": quality}),
            FaceEvent("face_lost", {}),
        ]

    def events(self) -> Iterator[FaceEvent]:
        import time

        while True:
            for ev in self._one_visit():
                yield ev
                time.sleep(self.interval_s / 2)
            time.sleep(self.interval_s)


class InsightFaceRecognizer:
    """Real recognizer — implemented in the InsightFace phase."""

    def __init__(self, *args, **kwargs) -> None:
        raise NotImplementedError(
            "InsightFace recognizer not implemented yet; set FACE_SERVICE_MODE=mock"
        )

    def events(self) -> Iterator[FaceEvent]:  # pragma: no cover
        raise NotImplementedError


def build_recognizer(
    mode: str, dim: int, interval_s: float, known_ratio: float = 0.5
) -> Recognizer:
    if mode == "mock":
        return MockRecognizer(dim=dim, interval_s=interval_s, known_ratio=known_ratio)
    if mode == "insightface":
        return InsightFaceRecognizer()
    raise ValueError(f"unknown FACE_SERVICE_MODE: {mode!r}")
