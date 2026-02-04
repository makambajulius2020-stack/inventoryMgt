from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import require_permission, resolve_effective_location_id
from app.db.deps import get_db
from app.models.rbac import User
from app.rbac.permissions import VIEW_INVENTORY
from app.services import inventory as inventory_service

router = APIRouter(prefix="/inventory")


@router.get("/on-hand")
def get_on_hand(
    location_id: int,
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(VIEW_INVENTORY))],
):
    effective_location_id = resolve_effective_location_id(db=db, user=user, requested_location_id=location_id)
    return {
        "location_id": effective_location_id,
        "item_id": item_id,
        "on_hand": inventory_service.on_hand(db=db, location_id=effective_location_id, item_id=item_id),
    }


@router.get("/available")
def get_available(
    location_id: int,
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(VIEW_INVENTORY))],
):
    effective_location_id = resolve_effective_location_id(db=db, user=user, requested_location_id=location_id)
    return {
        "location_id": effective_location_id,
        "item_id": item_id,
        "available": inventory_service.available(db=db, location_id=effective_location_id, item_id=item_id),
    }


@router.get("/by-location")
def get_by_location(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(VIEW_INVENTORY))],
):
    if user.location_id is not None:
        effective_location_id = int(user.location_id)
        return {
            "item_id": item_id,
            "by_location": [
                {
                    "location_id": effective_location_id,
                    "on_hand": inventory_service.on_hand(db=db, location_id=effective_location_id, item_id=item_id),
                }
            ],
        }
    return {"item_id": item_id, "by_location": inventory_service.by_location_stock(db=db, item_id=item_id)}


@router.get("/movements/by-source")
def get_movements_by_source(
    source_document_type: str,
    source_document_id: int,
    limit: int = 200,
    offset: int = 0,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(VIEW_INVENTORY))],
):
    location_id = int(user.location_id) if user.location_id is not None else None
    return {
        "source_document_type": source_document_type,
        "source_document_id": source_document_id,
        "movements": inventory_service.movements_by_source_document(
            db=db,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            location_id=location_id,
            limit=limit,
            offset=offset,
        ),
    }
