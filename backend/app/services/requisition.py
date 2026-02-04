from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.audit.logger import write_audit_event
from app.auth.deps import get_single_role_name
from app.models.enums import RequisitionStatus
from app.models.procurement import Requisition, RequisitionLine
from app.models.rbac import User


async def create_requisition(
    *,
    db: Session,
    actor: User,
    location_id: int,
    department_id: int,
    requested_by_user_id: int,
    notes: str,
    lines: list[dict[str, Any]],
) -> Requisition:
    req = Requisition(
        location_id=location_id,
        department_id=department_id,
        requested_by_user_id=requested_by_user_id,
        created_by_user_id=actor.id,
        status=RequisitionStatus.PENDING.value,
        notes=notes,
    )
    db.add(req)
    db.flush()

    for line in lines:
        db.add(
            RequisitionLine(
                requisition_id=req.id,
                item_id=int(line["item_id"]),
                quantity=float(line["quantity"]),
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
        action="REQUISITION_CREATED",
        entity_type="requisition",
        entity_id=req.id,
        location_id=req.location_id,
        before=None,
        after={"status": req.status},
        payload={
            "location_id": location_id,
            "department_id": department_id,
            "requested_by_user_id": requested_by_user_id,
            "notes": notes,
            "lines": lines,
        },
    )

    return req


async def review_requisition(*, db: Session, actor: User, requisition_id: int) -> Requisition:
    req = db.get(Requisition, requisition_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Not found")
    if req.status != RequisitionStatus.PENDING.value:
        raise HTTPException(status_code=409, detail="Invalid state")

    before = {"status": req.status}
    req.status = RequisitionStatus.REVIEWED.value
    db.commit()

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="REQUISITION_REVIEWED",
        entity_type="requisition",
        entity_id=req.id,
        location_id=req.location_id,
        before=before,
        after={"status": req.status},
        payload={},
    )

    return req


async def reject_requisition_reviewed(*, db: Session, actor: User, requisition_id: int) -> Requisition:
    req = db.get(Requisition, requisition_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Not found")
    if req.status != RequisitionStatus.REVIEWED.value:
        raise HTTPException(status_code=409, detail="Invalid state")

    before = {"status": req.status}
    req.status = RequisitionStatus.REJECTED.value
    db.commit()

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="REQUISITION_REJECTED",
        entity_type="requisition",
        entity_id=req.id,
        location_id=req.location_id,
        before=before,
        after={"status": req.status},
        payload={},
    )

    return req


async def approve_requisition(*, db: Session, actor: User, requisition_id: int) -> Requisition:
    req = db.get(Requisition, requisition_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Not found")
    if req.status != RequisitionStatus.REVIEWED.value:
        raise HTTPException(status_code=409, detail="Invalid state")

    before = {"status": req.status}
    req.status = RequisitionStatus.APPROVED.value
    db.commit()

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="REQUISITION_APPROVED",
        entity_type="requisition",
        entity_id=req.id,
        location_id=req.location_id,
        before=before,
        after={"status": req.status},
        payload={},
    )

    return req


async def reject_requisition_pending(*, db: Session, actor: User, requisition_id: int) -> Requisition:
    req = db.get(Requisition, requisition_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Not found")
    if req.status != RequisitionStatus.PENDING.value:
        raise HTTPException(status_code=409, detail="Invalid state")

    before = {"status": req.status}
    req.status = RequisitionStatus.REJECTED.value
    db.commit()

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="REQUISITION_REJECTED",
        entity_type="requisition",
        entity_id=req.id,
        location_id=req.location_id,
        before=before,
        after={"status": req.status},
        payload={},
    )

    return req
