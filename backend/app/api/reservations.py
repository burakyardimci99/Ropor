from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.services import dashboard

router = APIRouter(prefix="/api/reservations", tags=["reservations"])


@router.get("/today")
async def today(session: AsyncSession = Depends(get_session)) -> list[dict]:
    return await dashboard.reservations_today(session)


@router.get("/user/{user_id}")
async def for_user(
    user_id: UUID, session: AsyncSession = Depends(get_session)
) -> list[dict]:
    return await dashboard.reservations_for_user(session, user_id)
