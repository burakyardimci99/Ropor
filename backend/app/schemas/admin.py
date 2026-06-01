from pydantic import BaseModel


class AdminUserPatch(BaseModel):
    """Admin can change more fields than the user themselves."""

    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    leaderboard_opt_in: bool | None = None
    interests: list[str] | None = None
    bio: str | None = None


class AdminBadgeCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    icon_url: str | None = None
