from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.logger import write_audit_event
from app.auth.deps import get_current_user, get_user_context
from app.auth.jwt import create_access_token, create_refresh_token, decode_token
from app.auth.password import verify_password
from app.auth.schemas import LogoutIn, RefreshIn, TokenPairOut, UserContextOut
from app.db.deps import get_db
from app.models.permissions import RefreshToken
from app.models.rbac import User

router = APIRouter(prefix="/auth")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/login", response_model=TokenPairOut)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.execute(select(User).where(User.username == form.username)).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    ctx = get_user_context(db, user)

    access, access_exp = create_access_token(subject=str(user.id))
    refresh, jti, issued_at, refresh_exp = create_refresh_token(subject=str(user.id))

    db.add(
        RefreshToken(
            user_id=user.id,
            jti=jti,
            issued_at=issued_at,
            expires_at=refresh_exp,
            revoked_at=None,
            replaced_by_jti=None,
        )
    )
    db.commit()

    # Audit
    # before/after not applicable here; payload stored without password.
    await write_audit_event(
        actor_user_id=user.id,
        actor_email=user.username,
        actor_role=str(ctx.get("role")),
        actor_department_id=int(ctx["departmentId"]) if ctx.get("departmentId") is not None else None,
        action="LOGIN",
        entity_type="user",
        entity_id=user.id,
        location_id=user.location_id,
        before=None,
        after={"user_id": user.id},
        payload={"username": form.username},
    )

    return TokenPairOut(
        access_token=access,
        access_token_expires_at=access_exp,
        refresh_token=refresh,
        refresh_token_expires_at=refresh_exp,
        userContext=UserContextOut(**ctx),
    )


@router.get("/me", response_model=UserContextOut)
def me(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    return UserContextOut(**get_user_context(db, user))


@router.post("/refresh", response_model=TokenPairOut)
async def refresh_tokens(payload: RefreshIn, db: Annotated[Session, Depends(get_db)]):
    claims = decode_token(payload.refresh_token)
    if claims.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = int(claims.get("sub"))
    jti = str(claims.get("jti"))

    rt = db.execute(select(RefreshToken).where(RefreshToken.jti == jti)).scalar_one_or_none()
    if rt is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    if rt.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Token revoked")
    if rt.expires_at.replace(tzinfo=timezone.utc) <= _utcnow():
        raise HTTPException(status_code=401, detail="Token expired")

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid user")

    ctx = get_user_context(db, user)

    access, access_exp = create_access_token(subject=str(user.id))
    refresh, new_jti, issued_at, refresh_exp = create_refresh_token(subject=str(user.id))

    rt.revoked_at = _utcnow()
    rt.replaced_by_jti = new_jti

    db.add(
        RefreshToken(
            user_id=user.id,
            jti=new_jti,
            issued_at=issued_at,
            expires_at=refresh_exp,
            revoked_at=None,
            replaced_by_jti=None,
        )
    )

    db.commit()

    await write_audit_event(
        actor_user_id=user.id,
        actor_email=user.username,
        actor_role=str(ctx.get("role")),
        actor_department_id=int(ctx["departmentId"]) if ctx.get("departmentId") is not None else None,
        action="TOKEN_REFRESH",
        entity_type="user",
        entity_id=user.id,
        location_id=user.location_id,
        before={"refresh_jti": jti},
        after={"refresh_jti": new_jti},
        payload={},
    )

    return TokenPairOut(
        access_token=access,
        access_token_expires_at=access_exp,
        refresh_token=refresh,
        refresh_token_expires_at=refresh_exp,
        userContext=UserContextOut(**ctx),
    )


@router.post("/logout")
async def logout(payload: LogoutIn, db: Annotated[Session, Depends(get_db)]):
    claims = decode_token(payload.refresh_token)
    if claims.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = int(claims.get("sub"))
    jti = str(claims.get("jti"))

    rt = db.execute(select(RefreshToken).where(RefreshToken.jti == jti)).scalar_one_or_none()
    if rt is None:
        raise HTTPException(status_code=200, detail="Logged out")

    if rt.revoked_at is None:
        rt.revoked_at = _utcnow()
        db.commit()

    user = db.get(User, user_id)

    ctx = get_user_context(db, user) if user is not None else None

    await write_audit_event(
        actor_user_id=user_id,
        actor_email=getattr(user, "username", None) if user else None,
        actor_role=str(ctx.get("role")) if ctx else None,
        actor_department_id=int(ctx["departmentId"]) if (ctx and ctx.get("departmentId") is not None) else None,
        action="LOGOUT",
        entity_type="user",
        entity_id=user_id,
        location_id=getattr(user, "location_id", None) if user else None,
        before={"refresh_jti": jti},
        after={"revoked": True},
        payload={},
    )

    return {"status": "ok"}
