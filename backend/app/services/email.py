"""Email sending abstraction. MVP default: mock backend that logs the link."""
import logging

from app.core.config import settings

logger = logging.getLogger("services.email")


async def send_verification_email(to: str, token: str) -> None:
    link = f"{settings.public_base_url}/verify?token={token}"
    if settings.email_backend == "mock":
        logger.info("[MOCK EMAIL] verification for %s -> %s", to, link)
        return

    # Real SMTP/cloud delivery is wired in a later phase.
    raise NotImplementedError(
        f"email_backend={settings.email_backend!r} not implemented yet"
    )
