from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.logger import write_audit_event
from app.auth.deps import get_single_role_name
from app.models.enums import InventoryMovementType
from app.models.inventory import InventoryMovement
from app.models.portioning import PortioningBatch, PortioningInputLine, PortioningLossLine, PortioningOutputLine
from app.models.rbac import User
from app.services import inventory as inventory_service


SOURCE_TYPE = "PORTIONING_BATCH"


def _batch_snapshot(batch: PortioningBatch) -> dict[str, Any]:
    return {
        "id": batch.id,
        "location_id": batch.location_id,
        "status": batch.status,
        "notes": batch.notes,
    }


def _batch_lines_snapshot(db: Session, batch_id: int) -> dict[str, Any]:
    inputs = db.execute(select(PortioningInputLine.item_id, PortioningInputLine.quantity).where(PortioningInputLine.batch_id == batch_id)).all()
    outputs = db.execute(select(PortioningOutputLine.item_id, PortioningOutputLine.quantity).where(PortioningOutputLine.batch_id == batch_id)).all()
    losses = db.execute(select(PortioningLossLine.item_id, PortioningLossLine.quantity).where(PortioningLossLine.batch_id == batch_id)).all()

    return {
        "inputs": [{"item_id": int(i), "quantity": float(q)} for i, q in inputs],
        "outputs": [{"item_id": int(i), "quantity": float(q)} for i, q in outputs],
        "losses": [{"item_id": int(i), "quantity": float(q)} for i, q in losses],
    }


async def create_batch(
    *,
    db: Session,
    actor: User,
    location_id: int,
    notes: str,
    inputs: list[dict[str, Any]],
    outputs: list[dict[str, Any]],
    losses: list[dict[str, Any]] | None = None,
) -> PortioningBatch:
    batch = PortioningBatch(
        location_id=location_id,
        status="DRAFT",
        notes=notes,
        created_by_user_id=actor.id,
    )
    db.add(batch)
    db.flush()

    for ln in inputs:
        db.add(
            PortioningInputLine(
                batch_id=batch.id,
                item_id=int(ln["item_id"]),
                quantity=float(ln["quantity"]),
                status="ACTIVE",
                created_by_user_id=actor.id,
            )
        )

    for ln in outputs:
        db.add(
            PortioningOutputLine(
                batch_id=batch.id,
                item_id=int(ln["item_id"]),
                quantity=float(ln["quantity"]),
                status="ACTIVE",
                created_by_user_id=actor.id,
            )
        )

    for ln in (losses or []):
        db.add(
            PortioningLossLine(
                batch_id=batch.id,
                item_id=int(ln["item_id"]),
                quantity=float(ln["quantity"]),
                status="ACTIVE",
                created_by_user_id=actor.id,
            )
        )

    db.commit()

    after = _batch_snapshot(batch) | _batch_lines_snapshot(db, batch.id)

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="PORTIONING_BATCH_CREATED",
        entity_type="portioning_batch",
        entity_id=batch.id,
        location_id=batch.location_id,
        before=None,
        after=after,
        payload={},
    )

    return batch


async def confirm_batch(*, db: Session, actor: User, batch_id: int) -> PortioningBatch:
    batch = db.get(PortioningBatch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Not found")

    existing_mv_stmt = select(func.count(InventoryMovement.id)).where(
        InventoryMovement.source_document_type == SOURCE_TYPE,
        InventoryMovement.source_document_id == batch.id,
    )
    existing_count = int(db.execute(existing_mv_stmt).scalar_one() or 0)

    if batch.status == "CONFIRMED":
        return batch

    if existing_count > 0:
        raise HTTPException(status_code=409, detail="Ledger already posted for this batch")

    if batch.status != "DRAFT":
        raise HTTPException(status_code=409, detail="Invalid state")

    inputs = db.execute(select(PortioningInputLine).where(PortioningInputLine.batch_id == batch.id)).scalars().all()
    outputs = db.execute(select(PortioningOutputLine).where(PortioningOutputLine.batch_id == batch.id)).scalars().all()
    losses = db.execute(select(PortioningLossLine).where(PortioningLossLine.batch_id == batch.id)).scalars().all()

    if not inputs:
        raise HTTPException(status_code=409, detail="Batch must have at least one input")
    if not outputs:
        raise HTTPException(status_code=409, detail="Batch must have at least one output")

    required_by_item: dict[int, float] = {}
    for ln in inputs:
        required_by_item[int(ln.item_id)] = required_by_item.get(int(ln.item_id), 0.0) + float(ln.quantity)

    for item_id, req_qty in required_by_item.items():
        oh = inventory_service.on_hand(db=db, location_id=batch.location_id, item_id=item_id)
        if oh + 1e-9 < req_qty:
            raise HTTPException(status_code=409, detail="Insufficient on-hand for portioning")

    before = _batch_snapshot(batch) | _batch_lines_snapshot(db, batch.id)

    movements: list[InventoryMovement] = []

    for ln in inputs:
        mv = InventoryMovement(
            location_id=batch.location_id,
            item_id=ln.item_id,
            movement_type=InventoryMovementType.PORTIONING.value,
            quantity=-float(ln.quantity),
            unit_cost=0.0,
            status="POSTED",
            source_document_type=SOURCE_TYPE,
            source_document_id=batch.id,
            grn_id=None,
            requisition_id=None,
            source_department_id=None,
            destination_department_id=None,
            batch_ref="",
            expiry_date=None,
            created_by_user_id=actor.id,
        )
        movements.append(mv)
        db.add(mv)

    for ln in outputs:
        mv = InventoryMovement(
            location_id=batch.location_id,
            item_id=ln.item_id,
            movement_type=InventoryMovementType.PORTIONING.value,
            quantity=float(ln.quantity),
            unit_cost=0.0,
            status="POSTED",
            source_document_type=SOURCE_TYPE,
            source_document_id=batch.id,
            grn_id=None,
            requisition_id=None,
            source_department_id=None,
            destination_department_id=None,
            batch_ref="",
            expiry_date=None,
            created_by_user_id=actor.id,
        )
        movements.append(mv)
        db.add(mv)

    for ln in losses:
        mv = InventoryMovement(
            location_id=batch.location_id,
            item_id=ln.item_id,
            movement_type=InventoryMovementType.ADJUSTMENT.value,
            quantity=-float(ln.quantity),
            unit_cost=0.0,
            status="POSTED",
            source_document_type=SOURCE_TYPE,
            source_document_id=batch.id,
            grn_id=None,
            requisition_id=None,
            source_department_id=None,
            destination_department_id=None,
            batch_ref="",
            expiry_date=None,
            created_by_user_id=actor.id,
        )
        movements.append(mv)
        db.add(mv)

    batch.status = "CONFIRMED"
    db.commit()

    after = _batch_snapshot(batch) | _batch_lines_snapshot(db, batch.id)

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="PORTIONING_BATCH_CONFIRMED",
        entity_type="portioning_batch",
        entity_id=batch.id,
        location_id=batch.location_id,
        before=before,
        after=after,
        payload={"inventory_movements_created": len(movements)},
    )

    return batch
