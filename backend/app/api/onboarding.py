from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.onboarding import (
    OnboardingCancel,
    OnboardingComplete,
    OnboardingStart,
    OnboardingStartResponse,
    OnboardingUpdate,
)
from app.services import onboarding

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


@router.post("/start", response_model=OnboardingStartResponse)
async def start(
    body: OnboardingStart, session: AsyncSession = Depends(get_session)
) -> OnboardingStartResponse:
    obj = await onboarding.start(session, body.embedding_ref)
    return OnboardingStartResponse(session_id=str(obj.id), expires_at=obj.expires_at)


@router.post("/update")
async def update(
    body: OnboardingUpdate, session: AsyncSession = Depends(get_session)
) -> dict:
    obj = await onboarding.update_field(
        session, UUID(body.session_id), body.field, body.value
    )
    return {"session_id": str(obj.id), "status": obj.status}


@router.post("/complete")
async def complete(
    body: OnboardingComplete, session: AsyncSession = Depends(get_session)
) -> dict:
    return await onboarding.complete(
        session,
        UUID(body.session_id),
        full_name=body.full_name,
        email=body.email,
        role=body.role,
        interests=body.interests,
        kvkk_consent=body.kvkk_consent,
    )


@router.post("/cancel")
async def cancel(
    body: OnboardingCancel, session: AsyncSession = Depends(get_session)
) -> dict:
    await onboarding.cancel(session, UUID(body.session_id))
    return {"status": "abandoned"}
