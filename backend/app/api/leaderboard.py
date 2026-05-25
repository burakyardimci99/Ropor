from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.common import LeaderboardEntry
from app.services import dashboard

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("", response_model=list[LeaderboardEntry])
async def leaderboard(
    period: str = "monthly",
    limit: int = 20,
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    return await dashboard.leaderboard(session, period=period, limit=limit)
