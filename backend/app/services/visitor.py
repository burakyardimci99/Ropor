"""Visitor (guest) registration — lighter than onboarding, no account created."""
import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, VisitorSession
from app.services import presence

logger = logging.getLogger("services.visitor")


async def register(
    session: AsyncSession,
    visitor_name: str,
    host_user_id: UUID | None,
    purpose: str | None,
    embedding_ref: str | None = None,
) -> dict:
    host = None
    if host_user_id is not None:
        host = await session.get(User, host_user_id)
        if host is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Ziyaret edilen kişi bulunamadı.")

    embedding = None
    if embedding_ref:
        embedding = await presence.get_unknown_embedding(embedding_ref)

    vs = VisitorSession(
        visitor_name=visitor_name,
        host_user_id=host_user_id,
        purpose=purpose,
        temporary_face_embedding=embedding,
    )
    session.add(vs)
    await session.commit()
    await session.refresh(vs)

    message = "Hoş geldiniz!"
    if host is not None:
        # Host notification is mocked (logged) in the MVP; Slack/email later.
        logger.info("[MOCK NOTIFY] %s -> host %s: ziyaretçiniz var", visitor_name, host.email)
        host_first = host.full_name.split(" ")[0]
        message = f"{host_first} bilgilendirildi, sizi bekliyor."

    return {"visitor_session_id": str(vs.id), "message": message}
