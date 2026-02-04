from __future__ import annotations

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.settings import settings


def build_mysql_url() -> str:
    # Using PyMySQL driver for MySQL.
    return (
        f"mysql+pymysql://{settings.mysql_user}:{settings.mysql_password}"
        f"@{settings.mysql_host}:{settings.mysql_port}/{settings.mysql_db}"
        "?charset=utf8mb4"
    )


def build_database_url() -> str:
    # Local dev uses SQLite by default; MySQL can be used later by setting DATABASE_URL
    # or by switching to build_mysql_url().
    return settings.database_url


def create_db_engine() -> Engine:
    url = build_database_url()
    if url.startswith("sqlite:"):
        engine = create_engine(url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine
    return create_engine(url, pool_pre_ping=True)


engine = create_db_engine()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
