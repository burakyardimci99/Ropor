"""Onboarding business logic: turn an unknown face into a registered user."""
import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import USER_ROLES, FaceEmbedding, OnboardingSession, User, Visit
from app.services import presence
from app.services.email import send_verification_email

UPDATABLE_FIELDS = {"full_name", "email", "role", "interests"}


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def start(session: AsyncSession, embedding_ref: str) -> OnboardingSession:
    embedding = await presence.get_unknown_embedding(embedding_ref)
    if embedding is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Yüz verisi bulunamadı veya süresi doldu; lütfen kameraya tekrar bakın.",
        )
    obj = OnboardingSession(temporary_face_embedding=embedding, status="in_progress")
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    return obj


async def _get_active(session: AsyncSession, session_id: UUID) -> OnboardingSession:
    obj = await session.get(OnboardingSession, session_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Onboarding oturumu bulunamadı.")
    if obj.status in ("completed", "abandoned"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Oturum artık aktif değil.")
    if _aware(obj.expires_at) < datetime.now(timezone.utc):
        obj.status = "abandoned"
        await session.commit()
        raise HTTPException(status.HTTP_410_GONE, "Oturum süresi doldu.")
    return obj


async def update_field(
    session: AsyncSession, session_id: UUID, field: str, value
) -> OnboardingSession:
    if field not in UPDATABLE_FIELDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Geçersiz alan: {field}")
    obj = await _get_active(session, session_id)
    setattr(obj, field, value)
    await session.commit()
    await session.refresh(obj)
    return obj


def _check_email_domain(email: str) -> None:
    whitelist = settings.email_domain_list
    if whitelist:
        domain = email.split("@")[-1].lower()
        if domain not in whitelist:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Sadece şu alan adları kayıt olabilir: {', '.join(whitelist)}",
            )


async def complete(
    session: AsyncSession,
    session_id: UUID,
    full_name: str,
    email: str,
    role: str,
    interests: list[str],
    kvkk_consent: bool,
) -> dict:
    obj = await _get_active(session, session_id)

    if not kvkk_consent:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Yüz tanımayla kayıt için KVKK açık rızası gereklidir.",
        )
    if role not in USER_ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Geçersiz rol: {role}")
    _check_email_domain(email)

    existing = await session.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Bu email zaten kayıtlı. Sizseniz lab admin'ine ulaşın; değilse farklı bir email girin.",
        )

    now = datetime.now(timezone.utc)
    user = User(
        full_name=full_name,
        email=email,
        role=role,
        interests=interests or [],
        kvkk_consented_at=now,
    )
    session.add(user)
    await session.flush()  # assigns user.id

    session.add(
        FaceEmbedding(
            user_id=user.id,
            embedding=obj.temporary_face_embedding,
            source="onboarding",
        )
    )
    session.add(Visit(user_id=user.id))

    token = secrets.token_urlsafe(32)
    obj.full_name = full_name
    obj.email = email
    obj.role = role
    obj.interests = interests or []
    obj.verification_token = token
    obj.status = "completed"
    obj.completed_at = now

    await session.commit()

    await send_verification_email(email, token)

    first_name = full_name.split(" ")[0]
    return {
        "user": {
            "id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "interests": user.interests,
        },
        "welcome_message": f"Aramıza hoş geldin {first_name}! Doğrulama linki email'ine gönderildi.",
    }


async def cancel(session: AsyncSession, session_id: UUID) -> None:
    obj = await session.get(OnboardingSession, session_id)
    if obj is not None and obj.status not in ("completed",):
        obj.status = "abandoned"
        await session.commit()


async def verify_email(session: AsyncSession, token: str) -> dict:
    obj = await session.scalar(
        select(OnboardingSession).where(OnboardingSession.verification_token == token)
    )
    if obj is None or obj.email is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Geçersiz veya süresi dolmuş doğrulama linki."
        )
    user = await session.scalar(select(User).where(User.email == obj.email))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kullanıcı bulunamadı.")
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(timezone.utc)
        await session.commit()
    return {"status": "verified", "email": user.email, "full_name": user.full_name}
