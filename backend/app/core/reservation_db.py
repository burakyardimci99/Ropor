"""Read-only access to the external klab reservation database.

Separate database on the same Postgres server as ailab. The engine is built
lazily the first time it's needed, and only when ``reservation_database_url`` is
set — an empty URL disables every klab integration. We only ever SELECT here.
"""
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def is_configured() -> bool:
    return bool(settings.reservation_database_url)


def session() -> AsyncSession | None:
    """Open a read-only klab session, or None when the integration is off.

    The caller owns the ``async with``::

        sm = reservation_db.session()
        if sm is None:
            return
        async with sm as s:
            ...
    """
    global _sessionmaker
    if not is_configured():
        return None
    if _sessionmaker is None:
        engine = create_async_engine(settings.reservation_database_url, pool_pre_ping=True)
        _sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False)
    return _sessionmaker()
