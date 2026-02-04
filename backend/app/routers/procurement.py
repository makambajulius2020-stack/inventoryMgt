from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.logger import write_audit_event
from app.auth.deps import forbid_role, require_permission, resolve_effective_location_id, user_can_access_location
from app.db.deps import get_db
from app.models.enums import GRNStatus, InvoiceStatus, LPOStatus, PaymentStatus, RequisitionStatus
from app.models.procurement import (
    GRN,
    GRNLine,
    Invoice,
    InvoiceLine,
    LPO,
    LPOLine,
    Payment,
    Requisition,
    RequisitionLine,
)
from app.models.rbac import User
from app.rbac.permissions import (
    APPROVE_REQUISITION,
    CANCEL_LPO,
    CONFIRM_GRN_FINANCE,
    CONFIRM_GRN_STORE,
    REVIEW_REQUISITION,
    CREATE_GRN,
    CREATE_INVOICE,
    EVALUATE_INVOICE_MATCH,
    APPROVE_INVOICE_FOR_PAYMENT,
    CREATE_LPO,
    CREATE_PAYMENT,
    SCHEDULE_PAYMENT,
    MARK_PAYMENT_PAID,
    CANCEL_PAYMENT,
    CREATE_REQUISITION,
)
from app.services import requisition as requisition_service
from app.services import lpo as lpo_service
from app.services import grn as grn_service
from app.services import invoice as invoice_service
from app.services import payment as payment_service

router = APIRouter(prefix="/procurement")


# --------- Schemas ---------


class RequisitionLineIn(BaseModel):
    item_id: int
    quantity: float = Field(gt=0)


class RequisitionCreateIn(BaseModel):
    location_id: int
    department_id: int
    requested_by_user_id: int
    notes: str = ""
    lines: list[RequisitionLineIn]


class LPOLineIn(BaseModel):
    item_id: int
    ordered_qty: float = Field(gt=0)
    unit_price: float = Field(ge=0)


class LPOCreateIn(BaseModel):
    requisition_id: int
    vendor_id: int
    expected_delivery_date: date | None = None
    lines: list[LPOLineIn] = Field(min_length=1)

class GRNLineIn(BaseModel):
    item_id: int
    received_qty: float = Field(ge=0)
    unit_price: float = Field(ge=0)


class GRNCreateIn(BaseModel):
    lpo_id: int
    delivery_signed_by_name: str = ""
    notes: str = ""
    lines: list[GRNLineIn] = Field(min_length=1)

class InvoiceLineIn(BaseModel):
    item_id: int
    billed_qty: float = Field(ge=0)
    unit_price: float = Field(ge=0)


class InvoiceCreateIn(BaseModel):
    grn_id: int
    vendor_invoice_number: str
    notes: str = ""
    lines: list[InvoiceLineIn] = Field(min_length=1)


class PaymentCreateIn(BaseModel):
    invoice_id: int
    amount: float = Field(gt=0)
    method: str = ""
    reference: str = ""


# --------- Helpers ---------


def _sum_lines(lines: list[tuple[float, float]]) -> float:
    return sum(q * p for q, p in lines)


def _requisition_total(db: Session, requisition_id: int) -> float:
    stmt = select(RequisitionLine.quantity, 0.0).where(RequisitionLine.requisition_id == requisition_id)
    return _sum_lines([(float(q), 0.0) for q, _ in db.execute(stmt).all()])


def _lpo_total(db: Session, lpo_id: int) -> float:
    stmt = select(LPOLine.ordered_qty, LPOLine.unit_price).where(LPOLine.lpo_id == lpo_id)
    return _sum_lines([(float(q), float(p)) for q, p in db.execute(stmt).all()])


def _grn_total(db: Session, grn_id: int) -> float:
    stmt = select(GRNLine.received_qty, GRNLine.unit_price).where(GRNLine.grn_id == grn_id)
    return _sum_lines([(float(q), float(p)) for q, p in db.execute(stmt).all()])


def _invoice_total(db: Session, invoice_id: int) -> float:
    stmt = select(InvoiceLine.billed_qty, InvoiceLine.unit_price).where(InvoiceLine.invoice_id == invoice_id)
    return _sum_lines([(float(q), float(p)) for q, p in db.execute(stmt).all()])


def _paid_total(db: Session, invoice_id: int) -> float:
    stmt = select(Payment.id).where(Payment.invoice_id == invoice_id)
    _ = db.execute(stmt).all()
    # Phase 1: payments don't include amounts yet; adding it in Phase 2 finance workflows.
    return 0.0


# --------- Endpoints ---------


@router.post("/requisitions")
async def create_requisition(
    payload: RequisitionCreateIn,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CREATE_REQUISITION))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    effective_location_id = resolve_effective_location_id(db=db, user=user, requested_location_id=payload.location_id)

    req = await requisition_service.create_requisition(
        db=db,
        actor=user,
        location_id=effective_location_id,
        department_id=payload.department_id,
        requested_by_user_id=payload.requested_by_user_id,
        notes=payload.notes,
        lines=[l.model_dump() for l in payload.lines],
    )

    return {"id": req.id, "status": req.status}


@router.post("/requisitions/{requisition_id}/review")
async def review_requisition(
    requisition_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(REVIEW_REQUISITION))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    req = await requisition_service.review_requisition(db=db, actor=user, requisition_id=requisition_id)
    return {"id": req.id, "status": req.status}


@router.post("/requisitions/{requisition_id}/approve")
async def approve_requisition(
    requisition_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(APPROVE_REQUISITION))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    req = await requisition_service.approve_requisition(db=db, actor=user, requisition_id=requisition_id)
    return {"id": req.id, "status": req.status}


@router.post("/requisitions/{requisition_id}/reject")
async def reject_requisition_pending(
    requisition_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(REVIEW_REQUISITION))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    req = await requisition_service.reject_requisition_pending(db=db, actor=user, requisition_id=requisition_id)
    return {"id": req.id, "status": req.status}


@router.post("/requisitions/{requisition_id}/final-reject")
async def reject_requisition_reviewed(
    requisition_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(APPROVE_REQUISITION))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    req = await requisition_service.reject_requisition_reviewed(db=db, actor=user, requisition_id=requisition_id)
    return {"id": req.id, "status": req.status}


@router.post("/lpos")
async def create_lpo(
    payload: LPOCreateIn,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CREATE_LPO))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    lpo = await lpo_service.create_lpo(
        db=db,
        actor=user,
        requisition_id=payload.requisition_id,
        vendor_id=payload.vendor_id,
        expected_delivery_date=payload.expected_delivery_date,
        lines=[l.model_dump() for l in payload.lines],
    )
    return {"id": lpo.id, "status": lpo.status}


@router.post("/lpos/{lpo_id}/cancel")
async def cancel_lpo(
    lpo_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CANCEL_LPO))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    lpo = await lpo_service.cancel_lpo(db=db, actor=user, lpo_id=lpo_id)
    return {"id": lpo.id, "status": lpo.status}


@router.post("/grns")
async def create_grn(
    payload: GRNCreateIn,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CREATE_GRN))],
):
    grn = await grn_service.create_grn(
        db=db,
        actor=user,
        lpo_id=payload.lpo_id,
        delivery_signed_by_name=payload.delivery_signed_by_name,
        notes=payload.notes,
        lines=[l.model_dump() for l in payload.lines],
    )
    return {"id": grn.id, "status": grn.status}


@router.post("/grns/{grn_id}/confirm")
async def confirm_grn_store(
    grn_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CONFIRM_GRN_STORE))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    grn = await grn_service.confirm_grn_store(db=db, actor=user, grn_id=grn_id)
    return {"id": grn.id, "status": grn.status}


@router.post("/grns/{grn_id}/finance-confirm")
async def confirm_grn_finance(
    grn_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CONFIRM_GRN_FINANCE))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    grn = await grn_service.confirm_grn_finance(db=db, actor=user, grn_id=grn_id)
    return {"id": grn.id, "status": grn.status}


@router.get("/three-way/{grn_id}")
def three_way_match(
    grn_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CREATE_INVOICE))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    return grn_service.build_three_way_match_payload(db=db, grn_id=grn_id)


@router.post("/invoices")
async def create_invoice(
    payload: InvoiceCreateIn,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CREATE_INVOICE))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    grn = db.get(GRN, payload.grn_id)
    if grn is None:
        raise HTTPException(status_code=404, detail="GRN not found")
    if not user_can_access_location(db, user, grn.location_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    invoice = await invoice_service.create_invoice(
        db=db,
        actor=user,
        grn_id=payload.grn_id,
        vendor_invoice_number=payload.vendor_invoice_number,
        notes=payload.notes,
        lines=[l.model_dump() for l in payload.lines],
    )
    return {"id": invoice.id, "status": invoice.status}


@router.post("/invoices/{invoice_id}/evaluate-match")
async def evaluate_invoice_match(
    invoice_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(EVALUATE_INVOICE_MATCH))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    invoice_obj = db.get(Invoice, invoice_id)
    if invoice_obj is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not user_can_access_location(db, user, invoice_obj.location_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    invoice = await invoice_service.evaluate_match_and_set_status(db=db, actor=user, invoice_id=invoice_id)
    match = invoice_service.evaluate_three_way_match(db=db, invoice_id=invoice_id)
    return {"id": invoice.id, "status": invoice.status, "match": match}


@router.post("/invoices/{invoice_id}/approve-for-payment")
async def approve_invoice_for_payment(
    invoice_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(APPROVE_INVOICE_FOR_PAYMENT))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    invoice_obj = db.get(Invoice, invoice_id)
    if invoice_obj is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not user_can_access_location(db, user, invoice_obj.location_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    invoice = await invoice_service.approve_for_payment(db=db, actor=user, invoice_id=invoice_id)
    return {"id": invoice.id, "status": invoice.status}


@router.post("/payments")
async def create_payment(
    payload: PaymentCreateIn,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CREATE_PAYMENT))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    invoice_obj = db.get(Invoice, payload.invoice_id)
    if invoice_obj is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not user_can_access_location(db, user, invoice_obj.location_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    match = invoice_service.evaluate_three_way_match(db=db, invoice_id=invoice_obj.id)
    if not match["is_match"]:
        raise HTTPException(status_code=409, detail="Three-way match is not satisfied")

    pay = await payment_service.create_payment(
        db=db,
        actor=user,
        invoice_id=invoice_obj.id,
        amount=payload.amount,
        method=payload.method,
        reference=payload.reference,
        invoice_total=float(match["invoice"]["total"]),
    )
    return {"id": pay.id, "status": pay.status}


@router.post("/payments/{payment_id}/schedule")
async def schedule_payment(
    payment_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(SCHEDULE_PAYMENT))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    pay = db.get(Payment, payment_id)
    if pay is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    if not user_can_access_location(db, user, pay.location_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    pay = await payment_service.schedule_payment(db=db, actor=user, payment_id=payment_id)
    return {"id": pay.id, "status": pay.status}


@router.post("/payments/{payment_id}/mark-paid")
async def mark_payment_paid(
    payment_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(MARK_PAYMENT_PAID))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    pay = db.get(Payment, payment_id)
    if pay is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    if not user_can_access_location(db, user, pay.location_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    pay = await payment_service.mark_paid(db=db, actor=user, payment_id=payment_id)
    return {"id": pay.id, "status": pay.status}


@router.post("/payments/{payment_id}/cancel")
async def cancel_payment(
    payment_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CANCEL_PAYMENT))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    pay = db.get(Payment, payment_id)
    if pay is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    if not user_can_access_location(db, user, pay.location_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    pay = await payment_service.cancel_payment(db=db, actor=user, payment_id=payment_id)
    return {"id": pay.id, "status": pay.status}


@router.get("/invoices/{invoice_id}/aging")
def invoice_aging(
    invoice_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(APPROVE_INVOICE_FOR_PAYMENT))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    invoice_obj = db.get(Invoice, invoice_id)
    if invoice_obj is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not user_can_access_location(db, user, invoice_obj.location_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    return payment_service.aging(db=db, invoice_id=invoice_id)
