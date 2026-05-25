from datetime import datetime

from pydantic import BaseModel, EmailStr


class OnboardingStart(BaseModel):
    embedding_ref: str


class OnboardingStartResponse(BaseModel):
    session_id: str
    expires_at: datetime


class OnboardingUpdate(BaseModel):
    session_id: str
    field: str
    value: str | list[str]


class OnboardingComplete(BaseModel):
    session_id: str
    full_name: str
    email: EmailStr
    role: str
    interests: list[str] = []
    kvkk_consent: bool


class OnboardingCancel(BaseModel):
    session_id: str
