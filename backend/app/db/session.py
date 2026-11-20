"""Database engine and sessions.

The engine is created lazily on first use, so importing the app (and serving `/health`)
never opens a database connection.

Neon notes (context/deployment.md §2.2):
- the app uses the pooled URL (PgBouncer, transaction mode), so psycopg prepared statements
  are disabled with `prepare_threshold=None`;
- the pool stays small because the free instance and free database are small.
"""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


class DatabaseNotConfiguredError(RuntimeError):
    """Raised when DATABASE_URL is not set."""


def build_engine(url: str) -> Engine:
    return create_engine(
        url,
        pool_size=3,
        max_overflow=2,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args={"prepare_threshold": None, "connect_timeout": 10},
    )


@lru_cache
def get_engine() -> Engine:
    url = get_settings().database_url
    if not url:
        raise DatabaseNotConfiguredError("DATABASE_URL is not set")
    return build_engine(url)


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """FastAPI dependency yielding a session that is always closed."""
    session = _session_factory()()
    try:
        yield session
    finally:
        session.close()


def check_database() -> None:
    """Run a trivial query; raises if the database is not configured or unreachable."""
    with get_engine().connect() as connection:
        connection.execute(text("SELECT 1"))
