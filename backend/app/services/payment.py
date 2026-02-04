from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.logger import write_audit_event
from app.auth.deps import get_single_role_name
from app.models.enums import InvoiceStatus, PaymentStatus
from app.models.master import Vendor
from app.models.procurement import GRN, Invoice, LPO, Payment
from app.models.rbac import User


def _parse_terms_days(payment_terms: str) -> int | None:
    # Minimal, explainable parsing:
    # - if string contains a number, interpret it as credit days
    # Examples: "CREDIT_30", "NET30", "30", "CREDIT: 14"
    digits = "".join(ch for ch in payment_terms if ch.isdigit())
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def _invoice_vendor(db: Session, invoice: Invoice) -> Vendor | None:
    grn = db.get(GRN, invoice.grn_id)
    if grn is None:
        return None
    lpo = db.get(LPO, grn.lpo_id)
    if lpo is None:
        return None
    return db.get(Vendor, lpo.vendor_id)


def paid_total(*, db: Session, invoice_id: int) -> float:
    stmt = select(func.coalesce(func.sum(Payment.amount), 0.0)).where(
        Payment.invoice_id == invoice_id,
        Payment.status != PaymentStatus.CANCELLED.value,
    )
    val = db.execute(stmt).scalar_one()
    return float(val or 0.0)


def invoice_balance(*, db: Session, invoice_id: int, invoice_total: float) -> float:
    return float(invoice_total) - paid_total(db=db, invoice_id=invoice_id)


def aging(*, db: Session, invoice_id: int) -> dict[str, Any]:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    vendor = _invoice_vendor(db, invoice)
    terms_days = _parse_terms_days(vendor.payment_terms) if vendor is not None else None

    created = invoice.created_at.date() if hasattr(invoice.created_at, "date") else date.today()
    days_outstanding = (date.today() - created).days
    overdue = bool(terms_days is not None and days_outstanding > terms_days)

    return {
        "invoice_id": invoice.id,
        "vendor_id": getattr(vendor, "id", None),
        "terms_days": terms_days,
        "days_outstanding": days_outstanding,
        "is_overdue": overdue,
    }


def _payment_snapshot(payment: Payment) -> dict[str, Any]:
    return {
        "id": payment.id,
        "location_id": payment.location_id,
        "invoice_id": payment.invoice_id,
        "status": payment.status,
        "amount": float(payment.amount),
        "method": payment.method,
        "reference": payment.reference,
    }


async def create_payment(
    *,
    db: Session,
    actor: User,
    invoice_id: int,
    amount: float,
    method: str,
    reference: str,
    invoice_total: float,
) -> Payment:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status != InvoiceStatus.APPROVED_FOR_PAYMENT.value:
        raise HTTPException(status_code=409, detail="Invoice must be APPROVED_FOR_PAYMENT")

    if amount <= 0:
        raise HTTPException(status_code=422, detail="Amount must be > 0")

    balance = invoice_balance(db=db, invoice_id=invoice.id, invoice_total=invoice_total)
    if amount - balance > 1e-6:
        raise HTTPException(status_code=409, detail="Payment exceeds remaining balance")

    pay = Payment(
        location_id=invoice.location_id,
        invoice_id=invoice.id,
        created_by_user_id=actor.id,
        status=PaymentStatus.PENDING.value,
        amount=float(amount),
        method=method,
        reference=reference,
    )
    db.add(pay)
    db.commit()

    after = _payment_snapshot(pay)

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="PAYMENT_CREATED",
        entity_type="payment",
        entity_id=pay.id,
        location_id=pay.location_id,
        before=None,
        after=after,
        payload={"invoice_total": float(invoice_total), "remaining_balance": float(balance - amount)},
    )

    return pay


async def schedule_payment(*, db: Session, actor: User, payment_id: int) -> Payment:
    pay = db.get(Payment, payment_id)
    if pay is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    if pay.status != PaymentStatus.PENDING.value:
        raise HTTPException(status_code=409, detail="Payment must be PENDING to schedule")

    before = _payment_snapshot(pay)
    pay.status = PaymentStatus.SCHEDULED.value
    db.commit()

    after = _payment_snapshot(pay)
    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="PAYMENT_SCHEDULED",
        entity_type="payment",
        entity_id=pay.id,
        location_id=pay.location_id,
        before=before,
        after=after,
        payload={},
    )
    return pay


async def mark_paid(*, db: Session, actor: User, payment_id: int) -> Payment:
    pay = db.get(Payment, payment_id)
    if pay is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    if pay.status not in (PaymentStatus.PENDING.value, PaymentStatus.SCHEDULED.value):
        raise HTTPException(status_code=409, detail="Payment must be PENDING or SCHEDULED to mark paid")

    before = _payment_snapshot(pay)
    pay.status = PaymentStatus.PAID.value
    db.commit()

    after = _payment_snapshot(pay)
    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="PAYMENT_PAID",
        entity_type="payment",
        entity_id=pay.id,
        location_id=pay.location_id,
        before=before,
        after=after,
        payload={},
    )
    return pay


async def cancel_payment(*, db: Session, actor: User, payment_id: int) -> Payment:
    pay = db.get(Payment, payment_id)
    if pay is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    if pay.status == PaymentStatus.PAID.value:
        raise HTTPException(status_code=409, detail="Cannot cancel a PAID payment")

    before = _payment_snapshot(pay)
    pay.status = PaymentStatus.CANCELLED.value
    db.commit()

    after = _payment_snapshot(pay)
    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="PAYMENT_CANCELLED",
        entity_type="payment",
        entity_id=pay.id,
        location_id=pay.location_id,
        before=before,
        after=after,
        payload={},
    )
    return pay
