from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class UserContextOut(BaseModel):
    userId: int
    role: str
    branchId: int | None
    departmentId: int | None = None


class TokenPairOut(BaseModel):
    access_token: str
    access_token_expires_at: datetime
    refresh_token: str
    refresh_token_expires_at: datetime
    token_type: str = "bearer"
    userContext: UserContextOut | None = None


class LoginIn(BaseModel):
    username: str
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class LogoutIn(BaseModel):
    refresh_token: str
