from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.common import UserUpdate
from app.services import users

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{user_id}/profile")
async def profile(
    user_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict:
    return await users.get_profile(session, user_id)


@router.patch("/{user_id}")
async def update_user(
    user_id: UUID, body: UserUpdate, session: AsyncSession = Depends(get_session)
) -> dict:
    return await users.update_user(session, user_id, body.model_dump(exclude_unset=True))


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict:
    """KVKK erasure request — cascades all user data."""
    return await users.delete_user(session, user_id)
