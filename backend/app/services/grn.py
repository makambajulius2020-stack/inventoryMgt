from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.logger import write_audit_event
from app.auth.deps import get_single_role_name
from app.models.enums import GRNStatus, InventoryMovementType, LPOStatus
from app.models.inventory import InventoryMovement
from app.models.procurement import GRN, GRNLine, LPO, LPOLine
from app.models.rbac import User
from app.services import pricing as pricing_service


def _lpo_received_qty_by_item(db: Session, lpo_id: int) -> dict[int, float]:
    stmt = (
        select(GRNLine.item_id, func.coalesce(func.sum(GRNLine.received_qty), 0.0))
        .join(GRN, GRN.id == GRNLine.grn_id)
        .where(GRN.lpo_id == lpo_id, GRN.status.in_([GRNStatus.FINANCE_CONFIRMED.value]))
        .group_by(GRNLine.item_id)
    )
    return {int(item_id): float(qty) for item_id, qty in db.execute(stmt).all()}


def _grn_snapshot(grn: GRN) -> dict[str, Any]:
    return {
        "id": grn.id,
        "location_id": grn.location_id,
        "lpo_id": grn.lpo_id,
        "status": grn.status,
        "store_signed_by_user_id": grn.store_signed_by_user_id,
        "finance_signed_by_user_id": grn.finance_signed_by_user_id,
        "delivery_signed_by_name": grn.delivery_signed_by_name,
        "notes": grn.notes,
    }


def _lpo_snapshot(lpo: LPO) -> dict[str, Any]:
    return {
        "id": lpo.id,
        "location_id": lpo.location_id,
        "requisition_id": lpo.requisition_id,
        "vendor_id": lpo.vendor_id,
        "expected_delivery_date": lpo.expected_delivery_date.isoformat() if lpo.expected_delivery_date else None,
        "status": lpo.status,
    }


def _lpo_ordered_qty_by_item(db: Session, lpo_id: int) -> dict[int, float]:
    stmt = select(LPOLine.item_id, func.coalesce(func.sum(LPOLine.ordered_qty), 0.0)).where(LPOLine.lpo_id == lpo_id).group_by(LPOLine.item_id)
    return {int(item_id): float(qty) for item_id, qty in db.execute(stmt).all()}


def _compute_lpo_receipt_status(db: Session, lpo_id: int) -> str:
    ordered = _lpo_ordered_qty_by_item(db, lpo_id)
    received = _lpo_received_qty_by_item(db, lpo_id)

    if not ordered:
        return LPOStatus.ISSUED.value

    any_received = any(received.get(item_id, 0.0) > 0 for item_id in ordered.keys())
    if not any_received:
        return LPOStatus.ISSUED.value

    fully = all(received.get(item_id, 0.0) >= ordered_qty for item_id, ordered_qty in ordered.items())
    return LPOStatus.FULLY_RECEIVED.value if fully else LPOStatus.PARTIALLY_RECEIVED.value


async def create_grn(
    *,
    db: Session,
    actor: User,
    lpo_id: int,
    delivery_signed_by_name: str,
    notes: str,
    lines: list[dict[str, Any]],
) -> GRN:
    lpo = db.get(LPO, lpo_id)
    if lpo is None:
        raise HTTPException(status_code=404, detail="LPO not found")
    if lpo.status == LPOStatus.CANCELLED.value:
        raise HTTPException(status_code=409, detail="LPO cancelled")

    grn = GRN(
        location_id=lpo.location_id,
        lpo_id=lpo.id,
        created_by_user_id=actor.id,
        status=GRNStatus.DRAFT.value,
        store_signed_by_user_id=None,
        delivery_signed_by_name=delivery_signed_by_name,
        finance_signed_by_user_id=None,
        notes=notes,
    )
    db.add(grn)
    db.flush()

    for line in lines:
        db.add(
            GRNLine(
                grn_id=grn.id,
                item_id=int(line["item_id"]),
                received_qty=float(line["received_qty"]),
                unit_price=float(line["unit_price"]),
                created_by_user_id=actor.id,
                status="ACTIVE",
            )
        )

    db.commit()

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="GRN_CREATED",
        entity_type="grn",
        entity_id=grn.id,
        location_id=grn.location_id,
        before=None,
        after={"status": grn.status},
        payload={"lpo_id": lpo_id, "delivery_signed_by_name": delivery_signed_by_name, "notes": notes, "lines": lines},
    )

    return grn


async def confirm_grn_store(*, db: Session, actor: User, grn_id: int) -> GRN:
    grn = db.get(GRN, grn_id)
    if grn is None:
        raise HTTPException(status_code=404, detail="Not found")
    if grn.status == GRNStatus.FINANCE_CONFIRMED.value:
        raise HTTPException(status_code=409, detail="GRN already finance-confirmed")
    if grn.status != GRNStatus.DRAFT.value:
        raise HTTPException(status_code=409, detail="Invalid state")

    before = _grn_snapshot(grn)
    grn.status = GRNStatus.CONFIRMED.value
    grn.store_signed_by_user_id = actor.id
    db.commit()
    after = _grn_snapshot(grn)

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="GRN_CONFIRMED_STORE",
        entity_type="grn",
        entity_id=grn.id,
        location_id=grn.location_id,
        before=before,
        after=after,
        payload={},
    )

    return grn


async def confirm_grn_finance(*, db: Session, actor: User, grn_id: int) -> GRN:
    grn = db.get(GRN, grn_id)
    if grn is None:
        raise HTTPException(status_code=404, detail="Not found")
    if grn.status == GRNStatus.FINANCE_CONFIRMED.value:
        raise HTTPException(status_code=409, detail="GRN already finance-confirmed")
    if grn.status != GRNStatus.CONFIRMED.value:
        raise HTTPException(status_code=409, detail="GRN must be CONFIRMED by store")

    lpo = db.get(LPO, grn.lpo_id)
    if lpo is None:
        raise HTTPException(status_code=500, detail="LPO missing for GRN")
    if lpo.status == LPOStatus.CANCELLED.value:
        raise HTTPException(status_code=409, detail="Cannot finance-confirm GRN: LPO is CANCELLED")

    existing_mv_stmt = select(InventoryMovement.id).where(
        InventoryMovement.grn_id == grn.id,
        InventoryMovement.movement_type == InventoryMovementType.RECEIPT.value,
    )
    if db.execute(existing_mv_stmt).first() is not None:
        raise HTTPException(status_code=409, detail="Ledger already posted for this GRN")

    before = _grn_snapshot(grn)

    grn.status = GRNStatus.FINANCE_CONFIRMED.value
    grn.finance_signed_by_user_id = actor.id

    # Ledger postings: immutable facts
    lines_stmt = select(GRNLine).where(GRNLine.grn_id == grn.id)
    movements: list[InventoryMovement] = []
    for line in db.execute(lines_stmt).scalars().all():
        mv = InventoryMovement(
            location_id=grn.location_id,
            item_id=line.item_id,
            movement_type=InventoryMovementType.RECEIPT.value,
            quantity=float(line.received_qty),
            unit_cost=float(line.unit_price),
            status="POSTED",
            source_document_type="GRN",
            source_document_id=grn.id,
            grn_id=grn.id,
            requisition_id=lpo.requisition_id,
            source_department_id=None,
            destination_department_id=None,
            batch_ref="",
            expiry_date=None,
            created_by_user_id=actor.id,
        )
        movements.append(mv)
        db.add(mv)

    # Update LPO receipt status based on cumulative FINANCE_CONFIRMED receipts
    lpo_before = _lpo_snapshot(lpo)
    lpo.status = _compute_lpo_receipt_status(db, lpo.id)

    price_result = await pricing_service.record_price_observations_from_grn_finance_confirm(
        db=db,
        actor=actor,
        grn_id=grn.id,
        commit=False,
    )

    db.commit()
    after = _grn_snapshot(grn)
    lpo_after = _lpo_snapshot(lpo)

    for ev in price_result.get("pending_alert_audits", []) or []:
        await write_audit_event(
            actor_user_id=actor.id,
            actor_email=actor.username,
            actor_role=get_single_role_name(db, actor.id),
            actor_department_id=actor.department_id,
            action="PRICE_ALERT_CREATED",
            entity_type="price_alert",
            entity_id=int(ev["entity_id"]),
            location_id=int(ev["location_id"]),
            before=None,
            after=ev["after"],
            payload=ev["payload"],
        )

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="GRN_CONFIRMED_FINANCE",
        entity_type="grn",
        entity_id=grn.id,
        location_id=grn.location_id,
        before=before,
        after=after,
        payload={
            "inventory_movements_created": len(movements),
            "lpo_status_before": lpo_before.get("status"),
            "lpo_status_after": lpo_after.get("status"),
            "price_observations_created": int(price_result.get("observations_created", 0) or 0),
            "price_alerts_created": int(price_result.get("alerts_created", 0) or 0),
        },
    )

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="LPO_STATUS_UPDATED_FROM_RECEIPT",
        entity_type="lpo",
        entity_id=lpo.id,
        location_id=lpo.location_id,
        before=lpo_before,
        after=lpo_after,
        payload={"grn_id": grn.id},
    )

    return grn


def build_three_way_match_payload(*, db: Session, grn_id: int) -> dict[str, Any]:
    grn = db.get(GRN, grn_id)
    if grn is None:
        raise HTTPException(status_code=404, detail="GRN not found")

    lpo = db.get(LPO, grn.lpo_id)
    if lpo is None:
        raise HTTPException(status_code=500, detail="LPO missing for GRN")

    lpo_lines_stmt = select(LPOLine.item_id, LPOLine.ordered_qty, LPOLine.unit_price).where(LPOLine.lpo_id == lpo.id)
    grn_lines_stmt = select(GRNLine.item_id, GRNLine.received_qty, GRNLine.unit_price).where(GRNLine.grn_id == grn.id)

    lpo_lines = [
        {"item_id": int(i), "ordered_qty": float(q), "unit_price": float(p), "line_total": float(q) * float(p)}
        for i, q, p in db.execute(lpo_lines_stmt).all()
    ]
    grn_lines = [
        {"item_id": int(i), "received_qty": float(q), "unit_price": float(p), "line_total": float(q) * float(p)}
        for i, q, p in db.execute(grn_lines_stmt).all()
    ]

    lpo_total = sum(x["line_total"] for x in lpo_lines)
    grn_total = sum(x["line_total"] for x in grn_lines)

    return {
        "lpo": {"id": lpo.id, "status": lpo.status, "vendor_id": lpo.vendor_id, "requisition_id": lpo.requisition_id, "expected_delivery_date": lpo.expected_delivery_date, "lines": lpo_lines, "total": lpo_total},
        "grn": {"id": grn.id, "status": grn.status, "lines": grn_lines, "total": grn_total},
        "notes": "Invoice linkage will be resolved by GRN->Invoice when invoices are created.",
    }
