from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.jwt import TokenError, decode_token
from app.db.deps import get_db
from app.models.master import Location
from app.models.permissions import Permission, RolePermission, UserLocation
from app.models.rbac import Role, User, UserRole

PRRD_ALLOWED_ROLES = {
    "CEO",
    "BRANCH_MANAGER",
    "PROCUREMENT_HEAD",
    "FINANCE",
    "STORE_MANAGER",
    "DEPARTMENT_HEAD",
    "DEPARTMENT_STAFF",
}

PRRD_DEPARTMENT_ROLES = {"DEPARTMENT_HEAD", "DEPARTMENT_STAFF"}


def get_single_role_name(db: Session, user_id: int) -> str:
    stmt = (
        select(Role.name)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    )
    roles = [str(r[0]) for r in db.execute(stmt).all()]
    if not roles:
        raise HTTPException(status_code=403, detail="Forbidden")
    if len(roles) != 1:
        raise HTTPException(status_code=403, detail="Forbidden")
    role = roles[0]
    if role not in PRRD_ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Forbidden")
    return role


def enforce_email_identity(db: Session, user: User, role: str) -> None:
    email = (user.username or "").strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if role == "CEO":
        if email != "ceo@company.com":
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return

    # Branch-bound users must have exactly one branch.
    if user.location_id is None:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Format: <role>.<branch_code>@company.com
    if not email.endswith("@company.com") or "." not in email.split("@", 1)[0]:
        raise HTTPException(status_code=403, detail="Forbidden")

    local = email.split("@", 1)[0]
    role_part, branch_code = local.split(".", 1)

    expected_role_part = role.lower()
    if role_part != expected_role_part:
        raise HTTPException(status_code=403, detail="Forbidden")

    loc = db.get(Location, int(user.location_id))
    if loc is None or not loc.is_active:
        raise HTTPException(status_code=403, detail="Forbidden")
    if (loc.code or "").strip().lower() != branch_code:
        raise HTTPException(status_code=403, detail="Forbidden")


def get_user_context(db: Session, user: User) -> dict[str, int | str | None]:
    role = get_single_role_name(db, user.id)
    enforce_email_identity(db, user, role)

    branch_id = int(user.location_id) if user.location_id is not None else None
    department_id = int(user.department_id) if user.department_id is not None else None

    if role != "CEO" and branch_id is None:
        raise HTTPException(status_code=403, detail="Forbidden")

    if role in PRRD_DEPARTMENT_ROLES and department_id is None:
        raise HTTPException(status_code=403, detail="Forbidden")

    if role not in PRRD_DEPARTMENT_ROLES and department_id is not None:
        # Avoid cross-scope leakage; department binding only makes sense for dept roles.
        raise HTTPException(status_code=403, detail="Forbidden")

    return {
        "userId": int(user.id),
        "role": role,
        "branchId": branch_id,
        "departmentId": department_id,
    }

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    token: Annotated[str, Depends(oauth2_scheme)] = "",
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        claims = decode_token(token)
    except TokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if claims.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = int(claims.get("sub"))
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid user")

    return user


def user_has_role(db: Session, user_id: int, role_name: str) -> bool:
    stmt = (
        select(Role.name)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    )
    roles = [r[0] for r in db.execute(stmt).all()]
    return role_name in roles


def user_has_permission(db: Session, user_id: int, permission_name: str) -> bool:
    stmt = (
        select(Permission.name)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .where(UserRole.user_id == user_id)
    )
    perms = [r[0] for r in db.execute(stmt).all()]
    return permission_name in perms


def user_can_access_location(db: Session, user: User, location_id: int) -> bool:
    if user.location_id is not None and user.location_id == location_id:
        return True
    stmt = select(UserLocation.id).where(UserLocation.user_id == user.id, UserLocation.location_id == location_id)
    return db.execute(stmt).first() is not None


def resolve_effective_location_id(
    *,
    db: Session,
    user: User,
    requested_location_id: int | None,
) -> int:
    role = get_single_role_name(db, user.id)

    # PRRD: CEO is cross-branch; everyone else is exactly one branch.
    if role != "CEO" and user.location_id is None:
        raise HTTPException(status_code=403, detail="Forbidden")

    if user.location_id is not None:
        if requested_location_id is not None and requested_location_id != user.location_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        return int(user.location_id)

    if requested_location_id is None:
        raise HTTPException(status_code=422, detail="location_id is required")
    # Only CEO can reach this branch of the logic.
    return int(requested_location_id)


def require_role(role_name: str):
    def _guard(
        db: Annotated[Session, Depends(get_db)],
        user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if not user_has_role(db, user.id, role_name):
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return _guard


def forbid_role(role_name: str):
    def _guard(
        db: Annotated[Session, Depends(get_db)],
        user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if user_has_role(db, user.id, role_name):
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return _guard


def require_permission(permission_name: str):
    def _guard(
        db: Annotated[Session, Depends(get_db)],
        user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if not user_has_permission(db, user.id, permission_name):
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return _guard
