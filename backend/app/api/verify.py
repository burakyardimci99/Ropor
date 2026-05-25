from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.services import onboarding

router = APIRouter(prefix="/api", tags=["verify"])


@router.get("/verify")
async def verify(token: str, session: AsyncSession = Depends(get_session)) -> dict:
    return await onboarding.verify_email(session, token)
