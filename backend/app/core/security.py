"""Admin authentication.

MVP: a single shared Bearer token in ADMIN_TOKEN env. Lab admin's machine
sends it; everyone else gets 401/403. Sufficient for a small lab; replace
with per-user accounts if/when needed.
"""
import secrets

from fastapi import Header, HTTPException, status

from app.core.config import settings


async def require_admin(authorization: str = Header(default="")) -> None:
    expected = settings.admin_token
    if not expected:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "ADMIN_TOKEN tanımlı değil; admin paneli devre dışı.",
        )
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Authorization: Bearer <token> header'ı eksik.",
        )
    token = authorization[len("Bearer ") :].strip()
    # Constant-time compare to avoid timing-based token guessing.
    if not secrets.compare_digest(token, expected):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Geçersiz admin token.")
