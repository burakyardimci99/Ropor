from fastapi import APIRouter

from app.api import (
    dashboard,
    leaderboard,
    onboarding,
    reservations,
    users,
    verify,
    visitors,
)

api_router = APIRouter()
api_router.include_router(onboarding.router)
api_router.include_router(visitors.router)
api_router.include_router(users.router)
api_router.include_router(leaderboard.router)
api_router.include_router(dashboard.router)
api_router.include_router(reservations.router)
api_router.include_router(verify.router)
