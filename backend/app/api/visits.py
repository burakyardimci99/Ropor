from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import Visit

router = APIRouter(prefix="/api/visits", tags=["visits"])

# Visits older than this can't be tagged from the kiosk — guards against a
# random client annotating someone's past visit.
INTENT_WRITE_WINDOW = timedelta(minutes=30)
INTENT_MAX_LEN = 280


class IntentBody(BaseModel):
    intent: str = Field(min_length=1, max_length=INTENT_MAX_LEN)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.post("/{visit_id}/intent")
async def set_intent(
    visit_id: UUID,
    body: IntentBody,
    session: AsyncSession = Depends(get_session),
) -> dict:
    visit = await session.get(Visit, visit_id)
    if visit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ziyaret bulunamadı.")
    age = datetime.now(timezone.utc) - _aware(visit.entered_at)
    if age > INTENT_WRITE_WINDOW:
        raise HTTPException(
            status.HTTP_410_GONE,
            "Bu ziyaret artık güncellenemez (zaman aşımı).",
        )
    visit.daily_intent = body.intent.strip()
    await session.commit()
    return {"status": "saved"}
