from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.logger import write_audit_event
from app.auth.deps import get_single_role_name
from app.models.enums import LPOStatus, RequisitionStatus
from app.models.enums import GRNStatus
from app.models.procurement import GRN, LPO, LPOLine, Requisition
from app.models.rbac import User


def _lpo_snapshot(lpo: LPO) -> dict[str, Any]:
    return {
        "id": lpo.id,
        "location_id": lpo.location_id,
        "requisition_id": lpo.requisition_id,
        "vendor_id": lpo.vendor_id,
        "expected_delivery_date": lpo.expected_delivery_date.isoformat() if lpo.expected_delivery_date else None,
        "status": lpo.status,
    }


async def create_lpo(
    *,
    db: Session,
    actor: User,
    requisition_id: int,
    vendor_id: int,
    expected_delivery_date: date | None,
    lines: list[dict[str, Any]],
) -> LPO:
    req = db.get(Requisition, requisition_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Requisition not found")
    if req.status != RequisitionStatus.APPROVED.value:
        raise HTTPException(status_code=409, detail="Requisition must be APPROVED")

    lpo = LPO(
        location_id=req.location_id,
        vendor_id=vendor_id,
        requisition_id=req.id,
        expected_delivery_date=expected_delivery_date,
        created_by_user_id=actor.id,
        status=LPOStatus.ISSUED.value,
    )
    db.add(lpo)
    db.flush()

    for line in lines:
        db.add(
            LPOLine(
                lpo_id=lpo.id,
                item_id=int(line["item_id"]),
                ordered_qty=float(line["ordered_qty"]),
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
        action="LPO_CREATED",
        entity_type="lpo",
        entity_id=lpo.id,
        location_id=lpo.location_id,
        before=None,
        after={"status": lpo.status},
        payload={
            "requisition_id": requisition_id,
            "vendor_id": vendor_id,
            "expected_delivery_date": expected_delivery_date.isoformat() if expected_delivery_date else None,
            "lines": lines,
        },
    )

    return lpo


async def cancel_lpo(*, db: Session, actor: User, lpo_id: int, reason: str = "") -> LPO:
    lpo = db.get(LPO, lpo_id)
    if lpo is None:
        raise HTTPException(status_code=404, detail="Not found")
    if lpo.status != LPOStatus.ISSUED.value:
        raise HTTPException(status_code=409, detail="Only ISSUED LPOs can be cancelled")

    grn_stmt = select(GRN.id).where(
        GRN.lpo_id == lpo.id,
        GRN.status.in_([GRNStatus.CONFIRMED.value, GRNStatus.FINANCE_CONFIRMED.value]),
    )
    if db.execute(grn_stmt).first() is not None:
        raise HTTPException(status_code=409, detail="Cannot cancel LPO: confirmed GRN exists")

    before = _lpo_snapshot(lpo)
    lpo.status = LPOStatus.CANCELLED.value
    db.commit()
    after = _lpo_snapshot(lpo)

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="LPO_CANCELLED",
        entity_type="lpo",
        entity_id=lpo.id,
        location_id=lpo.location_id,
        before=before,
        after=after,
        payload={"reason": reason},
    )

    return lpo
