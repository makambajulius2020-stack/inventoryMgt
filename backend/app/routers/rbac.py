from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import require_permission
from app.db.deps import get_db
from app.models.rbac import Role, UserRole
from app.rbac.permissions import VIEW_RBAC

router = APIRouter(prefix="/rbac")


class MeOut(BaseModel):
    user_id: int
    roles: list[str]


@router.get("/me", response_model=MeOut)
def me(
    db: Annotated[Session, Depends(get_db)],
    user=Depends(require_permission(VIEW_RBAC)),
):
    stmt = (
        select(Role.name)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user.id)
    )
    roles = [r[0] for r in db.execute(stmt).all()]
    return MeOut(user_id=user.id, roles=roles)
