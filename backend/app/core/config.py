from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://lab:lab_dev_password@postgres:5432/ailab"
    )
    database_url_sync: str = Field(
        default="postgresql+psycopg://lab:lab_dev_password@postgres:5432/ailab"
    )

    # Redis
    redis_url: str = Field(default="redis://redis:6379/0")

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000"

    # Face recognition
    face_match_threshold: float = 0.55
    face_unknown_threshold: float = 0.45
    visit_debounce_minutes: int = 30
    # Re-show the welcome screen for a recognized user at most once per this
    # window. If a face already entered within this window we stay silent
    # instead of greeting again. Prevents the continuous face-frame stream from
    # re-triggering the greeting every frame.
    greet_cooldown_seconds: int = 600  # 10 dk
    # Frame-confirmation gates: a face must be seen this many times within
    # ``face_confirm_window_seconds`` before we act, which filters out
    # single-frame false matches. At ~2 fps these are ~1.5-2s of presence.
    face_confirm_frames: int = 3  # tanınan yüz: kaç kare sonra hoşgeldin
    unknown_confirm_frames: int = 4  # bilinmeyen yüz: kaç kare sonra kayıt ekranı
    # Sliding window the confirmation counters live in; resets if the face
    # leaves the frame for longer than this.
    face_confirm_window_seconds: int = 4
    # Eagerly load InsightFace at startup. Disable for fast cold-starts during dev.
    face_extractor_eager_warm: bool = True

    # Local timezone used for day-based stats (e.g. visit streaks).
    lab_timezone: str = "Europe/Istanbul"

    # Master demo switch. When false, the seed script refuses to populate demo
    # data and the mock face-service stops emitting synthetic faces. Flip to
    # true to bring the canned demo (mock + seed) back together.
    demo_mode: bool = False

    # Admin panel: empty disables the panel entirely (503 from admin endpoints).
    admin_token: str = ""

    # Email
    email_backend: str = "mock"  # mock | smtp
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "noreply@lab.example.com"
    public_base_url: str = "http://localhost:3000"
    email_domain_whitelist: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def email_domain_list(self) -> list[str]:
        return [d.strip().lower() for d in self.email_domain_whitelist.split(",") if d.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
