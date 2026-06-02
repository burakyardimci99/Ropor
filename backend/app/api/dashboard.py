from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.services import dashboard

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/live")
async def live(session: AsyncSession = Depends(get_session)) -> dict:
    return await dashboard.live(session)


@router.get("/density")
async def density(session: AsyncSession = Depends(get_session)) -> dict:
    return await dashboard.weekly_density(session)
