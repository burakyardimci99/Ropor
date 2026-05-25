"""Deterministic demo embedding helper.

Pure-Python (no numpy) so the exact same vector can be reproduced in the
face-service mock and in the backend seed script without a shared dependency.
Both sides must use the same algorithm/seed for the demo recognition to match.
"""
import math
import random

EMBEDDING_DIM = 512


def demo_known_embedding(seed: int = 42, dim: int = EMBEDDING_DIM) -> list[float]:
    rng = random.Random(seed)
    vec = [rng.gauss(0.0, 1.0) for _ in range(dim)]
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]
