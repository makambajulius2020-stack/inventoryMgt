from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from jose import JWTError, jwt

from app.settings import settings


class TokenError(Exception):
    pass


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(*, subject: str, extra_claims: dict[str, Any] | None = None) -> tuple[str, datetime]:
    expire = _now_utc() + timedelta(minutes=settings.jwt_access_token_minutes)
    to_encode: dict[str, Any] = {
        "sub": subject,
        "type": "access",
        "exp": expire,
        "iat": _now_utc(),
    }
    if extra_claims:
        to_encode.update(extra_claims)

    token = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expire


def create_refresh_token(*, subject: str) -> tuple[str, str, datetime, datetime]:
    jti = uuid4().hex
    issued_at = _now_utc()
    expire = issued_at + timedelta(days=settings.jwt_refresh_token_days)
    to_encode: dict[str, Any] = {
        "sub": subject,
        "type": "refresh",
        "jti": jti,
        "iat": issued_at,
        "exp": expire,
    }
    token = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, jti, issued_at, expire


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise TokenError("Invalid token") from e
