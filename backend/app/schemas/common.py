from uuid import UUID

from pydantic import BaseModel


class VisitorRegister(BaseModel):
    visitor_name: str
    host_user_id: UUID | None = None
    purpose: str | None = None
    embedding_ref: str | None = None


class UserUpdate(BaseModel):
    bio: str | None = None
    interests: list[str] | None = None
    avatar_url: str | None = None
    leaderboard_opt_in: bool | None = None


class LeaderboardEntry(BaseModel):
    user_id: UUID
    full_name: str
    visit_count: int
    badge_count: int = 0
