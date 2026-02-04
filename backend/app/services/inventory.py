from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryMovement


def on_hand(*, db: Session, location_id: int, item_id: int) -> float:
    stmt = select(func.coalesce(func.sum(InventoryMovement.quantity), 0.0)).where(
        InventoryMovement.location_id == location_id,
        InventoryMovement.item_id == item_id,
        InventoryMovement.status == "POSTED",
    )
    val = db.execute(stmt).scalar_one()
    return float(val or 0.0)


def by_location_stock(*, db: Session, item_id: int) -> list[dict]:
    stmt = (
        select(InventoryMovement.location_id, func.coalesce(func.sum(InventoryMovement.quantity), 0.0))
        .where(InventoryMovement.item_id == item_id, InventoryMovement.status == "POSTED")
        .group_by(InventoryMovement.location_id)
    )
    return [{"location_id": int(loc), "on_hand": float(qty or 0.0)} for loc, qty in db.execute(stmt).all()]


def available(*, db: Session, location_id: int, item_id: int) -> float:
    # Phase 4 baseline: no reservation system yet, so available == on_hand.
    return on_hand(db=db, location_id=location_id, item_id=item_id)


def movements_by_source_document(
    *,
    db: Session,
    source_document_type: str,
    source_document_id: int,
    location_id: int | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[dict]:
    if limit <= 0 or limit > 1000:
        raise HTTPException(status_code=409, detail="limit must be between 1 and 1000")
    if offset < 0:
        raise HTTPException(status_code=409, detail="offset must be >= 0")

    stmt = (
        select(InventoryMovement)
        .where(
            InventoryMovement.source_document_type == source_document_type,
            InventoryMovement.source_document_id == source_document_id,
        )
        .order_by(InventoryMovement.created_at.asc(), InventoryMovement.id.asc())
        .offset(int(offset))
        .limit(int(limit))
    )

    if location_id is not None:
        stmt = stmt.where(InventoryMovement.location_id == location_id)

    rows = db.execute(stmt).scalars().all()
    return [
        {
            "id": r.id,
            "created_at": r.created_at,
            "location_id": r.location_id,
            "item_id": r.item_id,
            "movement_type": str(r.movement_type),
            "quantity": float(r.quantity),
            "unit_cost": float(r.unit_cost),
            "status": r.status,
            "source_document_type": r.source_document_type,
            "source_document_id": r.source_document_id,
            "grn_id": r.grn_id,
            "requisition_id": r.requisition_id,
            "source_department_id": r.source_department_id,
            "destination_department_id": r.destination_department_id,
        }
        for r in rows
    ]
