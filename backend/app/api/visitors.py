from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.common import VisitorRegister
from app.services import visitor

router = APIRouter(prefix="/api/visitors", tags=["visitors"])


@router.post("/register")
async def register(
    body: VisitorRegister, session: AsyncSession = Depends(get_session)
) -> dict:
    return await visitor.register(
        session,
        visitor_name=body.visitor_name,
        host_user_id=body.host_user_id,
        purpose=body.purpose,
        embedding_ref=body.embedding_ref,
    )
