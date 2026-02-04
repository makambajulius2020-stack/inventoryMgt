from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import require_permission, resolve_effective_location_id, user_can_access_location
from app.db.deps import get_db
from app.models.rbac import User
from app.rbac.permissions import VIEW_PRICING
from app.services import pricing as pricing_service

router = APIRouter(prefix="/pricing")


@router.get("/history")
def price_history(
    location_id: int,
    item_id: int | None = None,
    vendor_id: int | None = None,
    limit: int = 200,
    offset: int = 0,
    db: Annotated[Session, Depends(get_db)] = Depends(get_db),
    user: Annotated[User, Depends(require_permission(VIEW_PRICING))] = Depends(require_permission(VIEW_PRICING)),
):
    effective_location_id = resolve_effective_location_id(db=db, user=user, requested_location_id=location_id)

    return {
        "location_id": effective_location_id,
        "item_id": item_id,
        "vendor_id": vendor_id,
        "rows": pricing_service.query_price_history(
            db=db,
            location_id=effective_location_id,
            item_id=item_id,
            vendor_id=vendor_id,
            limit=limit,
            offset=offset,
        ),
    }


@router.get("/alerts")
def price_alerts(
    location_id: int,
    status: str | None = None,
    item_id: int | None = None,
    vendor_id: int | None = None,
    limit: int = 200,
    offset: int = 0,
    db: Annotated[Session, Depends(get_db)] = Depends(get_db),
    user: Annotated[User, Depends(require_permission(VIEW_PRICING))] = Depends(require_permission(VIEW_PRICING)),
):
    effective_location_id = resolve_effective_location_id(db=db, user=user, requested_location_id=location_id)

    return {
        "location_id": effective_location_id,
        "status": status,
        "item_id": item_id,
        "vendor_id": vendor_id,
        "rows": pricing_service.query_price_alerts(
            db=db,
            location_id=effective_location_id,
            status=status,
            item_id=item_id,
            vendor_id=vendor_id,
            limit=limit,
            offset=offset,
        ),
    }


@router.get("/outliers/vendor")
def vendor_outliers(
    location_id: int,
    vendor_id: int,
    threshold_pct: float | None = None,
    window_n: int = 10,
    limit: int = 200,
    db: Annotated[Session, Depends(get_db)] = Depends(get_db),
    user: Annotated[User, Depends(require_permission(VIEW_PRICING))] = Depends(require_permission(VIEW_PRICING)),
):
    effective_location_id = resolve_effective_location_id(db=db, user=user, requested_location_id=location_id)

    return {
        "location_id": effective_location_id,
        "vendor_id": vendor_id,
        "threshold_pct": threshold_pct,
        "window_n": window_n,
        "rows": pricing_service.query_vendor_outliers(
            db=db,
            location_id=effective_location_id,
            vendor_id=vendor_id,
            threshold_pct=threshold_pct,
            window_n=window_n,
            limit=limit,
        ),
    }
