from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.logger import write_audit_event
from app.auth.deps import get_single_role_name
from app.models.enums import GRNStatus, InvoiceStatus
from app.models.procurement import GRN, GRNLine, Invoice, InvoiceLine, LPO, LPOLine
from app.models.rbac import User


def _sum_lines(lines: list[tuple[float, float]]) -> float:
    return sum(q * p for q, p in lines)


def _lpo_lines(db: Session, lpo_id: int) -> list[dict[str, Any]]:
    stmt = select(LPOLine.item_id, LPOLine.ordered_qty, LPOLine.unit_price).where(LPOLine.lpo_id == lpo_id)
    return [
        {"item_id": int(i), "quantity": float(q), "unit_price": float(p), "line_total": float(q) * float(p)}
        for i, q, p in db.execute(stmt).all()
    ]


def _grn_lines(db: Session, grn_id: int) -> list[dict[str, Any]]:
    stmt = select(GRNLine.item_id, GRNLine.received_qty, GRNLine.unit_price).where(GRNLine.grn_id == grn_id)
    return [
        {"item_id": int(i), "quantity": float(q), "unit_price": float(p), "line_total": float(q) * float(p)}
        for i, q, p in db.execute(stmt).all()
    ]


def _invoice_lines(db: Session, invoice_id: int) -> list[dict[str, Any]]:
    stmt = select(InvoiceLine.item_id, InvoiceLine.billed_qty, InvoiceLine.unit_price).where(InvoiceLine.invoice_id == invoice_id)
    return [
        {"item_id": int(i), "quantity": float(q), "unit_price": float(p), "line_total": float(q) * float(p)}
        for i, q, p in db.execute(stmt).all()
    ]


def _index_by_item(lines: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    return {int(x["item_id"]): x for x in lines}


def _invoice_snapshot(db: Session, invoice: Invoice) -> dict[str, Any]:
    return {
        "id": invoice.id,
        "location_id": invoice.location_id,
        "grn_id": invoice.grn_id,
        "vendor_invoice_number": invoice.vendor_invoice_number,
        "status": invoice.status,
        "notes": invoice.notes,
        "lines": _invoice_lines(db, invoice.id),
    }


async def create_invoice(
    *,
    db: Session,
    actor: User,
    grn_id: int,
    vendor_invoice_number: str,
    notes: str,
    lines: list[dict[str, Any]],
) -> Invoice:
    grn = db.get(GRN, grn_id)
    if grn is None:
        raise HTTPException(status_code=404, detail="GRN not found")
    if grn.status != GRNStatus.FINANCE_CONFIRMED.value:
        raise HTTPException(status_code=409, detail="GRN must be FINANCE_CONFIRMED")

    existing = db.execute(select(Invoice.id).where(Invoice.grn_id == grn.id)).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Invoice already exists for this GRN")

    invoice = Invoice(
        location_id=grn.location_id,
        grn_id=grn.id,
        vendor_invoice_number=vendor_invoice_number,
        created_by_user_id=actor.id,
        status=InvoiceStatus.DRAFT.value,
        notes=notes,
    )
    db.add(invoice)
    db.flush()

    for line in lines:
        db.add(
            InvoiceLine(
                invoice_id=invoice.id,
                item_id=int(line["item_id"]),
                billed_qty=float(line["billed_qty"]),
                unit_price=float(line["unit_price"]),
                created_by_user_id=actor.id,
                status="ACTIVE",
            )
        )

    db.commit()

    after = _invoice_snapshot(db, invoice)

    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="INVOICE_CREATED",
        entity_type="invoice",
        entity_id=invoice.id,
        location_id=invoice.location_id,
        before=None,
        after=after,
        payload={},
    )

    return invoice


def evaluate_three_way_match(*, db: Session, invoice_id: int) -> dict[str, Any]:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    grn = db.get(GRN, invoice.grn_id)
    if grn is None:
        raise HTTPException(status_code=500, detail="GRN missing for invoice")

    lpo = db.get(LPO, grn.lpo_id)
    if lpo is None:
        raise HTTPException(status_code=500, detail="LPO missing for GRN")

    lpo_lines = _lpo_lines(db, lpo.id)
    grn_lines = _grn_lines(db, grn.id)
    inv_lines = _invoice_lines(db, invoice.id)

    lpo_by_item = _index_by_item(lpo_lines)
    grn_by_item = _index_by_item(grn_lines)
    inv_by_item = _index_by_item(inv_lines)

    all_item_ids = sorted(set(lpo_by_item.keys()) | set(grn_by_item.keys()) | set(inv_by_item.keys()))

    discrepancies: list[dict[str, Any]] = []
    for item_id in all_item_ids:
        lpo_ln = lpo_by_item.get(item_id)
        grn_ln = grn_by_item.get(item_id)
        inv_ln = inv_by_item.get(item_id)

        if lpo_ln is None or grn_ln is None or inv_ln is None:
            discrepancies.append(
                {
                    "item_id": item_id,
                    "type": "MISSING_LINE",
                    "lpo": lpo_ln,
                    "grn": grn_ln,
                    "invoice": inv_ln,
                }
            )
            continue

        # Quantities: invoice billed qty must equal GRN received qty for this one-GRN invoice.
        if abs(float(inv_ln["quantity"]) - float(grn_ln["quantity"])) > 1e-6:
            discrepancies.append(
                {
                    "item_id": item_id,
                    "type": "QTY_MISMATCH",
                    "lpo_qty": float(lpo_ln["quantity"]),
                    "grn_qty": float(grn_ln["quantity"]),
                    "invoice_qty": float(inv_ln["quantity"]),
                }
            )

        # Unit prices: invoice price must match LPO price, and GRN should match LPO.
        if abs(float(inv_ln["unit_price"]) - float(lpo_ln["unit_price"])) > 1e-6:
            discrepancies.append(
                {
                    "item_id": item_id,
                    "type": "UNIT_PRICE_MISMATCH_INVOICE_VS_LPO",
                    "lpo_unit_price": float(lpo_ln["unit_price"]),
                    "invoice_unit_price": float(inv_ln["unit_price"]),
                }
            )

        if abs(float(grn_ln["unit_price"]) - float(lpo_ln["unit_price"])) > 1e-6:
            discrepancies.append(
                {
                    "item_id": item_id,
                    "type": "UNIT_PRICE_MISMATCH_GRN_VS_LPO",
                    "lpo_unit_price": float(lpo_ln["unit_price"]),
                    "grn_unit_price": float(grn_ln["unit_price"]),
                }
            )

        # Line totals are derivable; validate that computed totals match the system's computations.
        expected_inv_line_total = float(inv_ln["quantity"]) * float(inv_ln["unit_price"])
        if abs(float(inv_ln["line_total"]) - expected_inv_line_total) > 1e-6:
            discrepancies.append(
                {
                    "item_id": item_id,
                    "type": "INVOICE_LINE_TOTAL_MISMATCH",
                    "invoice_line_total": float(inv_ln["line_total"]),
                    "computed": expected_inv_line_total,
                }
            )

    lpo_total = _sum_lines([(float(x["quantity"]), float(x["unit_price"])) for x in lpo_lines])
    grn_total = _sum_lines([(float(x["quantity"]), float(x["unit_price"])) for x in grn_lines])
    invoice_total = _sum_lines([(float(x["quantity"]), float(x["unit_price"])) for x in inv_lines])

    if abs(lpo_total - grn_total) > 1e-6:
        discrepancies.append({"type": "GRAND_TOTAL_MISMATCH_LPO_VS_GRN", "lpo_total": lpo_total, "grn_total": grn_total})

    if abs(grn_total - invoice_total) > 1e-6:
        discrepancies.append(
            {"type": "GRAND_TOTAL_MISMATCH_GRN_VS_INVOICE", "grn_total": grn_total, "invoice_total": invoice_total}
        )

    return {
        "lpo": {"id": lpo.id, "total": lpo_total, "lines": lpo_lines},
        "grn": {"id": grn.id, "total": grn_total, "lines": grn_lines},
        "invoice": {"id": invoice.id, "total": invoice_total, "lines": inv_lines},
        "discrepancies": discrepancies,
        "is_match": len(discrepancies) == 0,
    }


async def evaluate_match_and_set_status(*, db: Session, actor: User, invoice_id: int) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == InvoiceStatus.APPROVED_FOR_PAYMENT.value:
        raise HTTPException(status_code=409, detail="Invoice already approved for payment")

    if invoice.status not in (
        InvoiceStatus.DRAFT.value,
        InvoiceStatus.MATCHED.value,
        InvoiceStatus.DISCREPANCY.value,
    ):
        raise HTTPException(status_code=409, detail="Invalid state")

    before = _invoice_snapshot(db, invoice)

    result = evaluate_three_way_match(db=db, invoice_id=invoice.id)

    invoice.status = InvoiceStatus.MATCHED.value if result["is_match"] else InvoiceStatus.DISCREPANCY.value
    if not result["is_match"]:
        invoice.notes = (invoice.notes + "\n" if invoice.notes else "") + "Three-way match discrepancy detected."

    db.commit()

    after =or_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        act _invoice_snapshot(db, invoice)

    await write_audit_event(
        actor_user_id=actor.id,
        action="INVOICE_MATCH_EVALUATED",
        entity_type="invoice",
        entity_id=invoice.id,
        location_id=invoice.location_id,
        before=before,
        after=after,
        payload={"match": result},
    )

    return invoice


async def approve_for_payment(*, db: Session, actor: User, invoice_id: int) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status != InvoiceStatus.MATCHED.value:
        raise HTTPException(status_code=409, detail="Invoice must be MATCHED to approve for payment")

    before = _invoice_snapshot(db, invoice)
    invoice.status = InvoiceStatus.APPROVED_FOR_PAYMENT.value
    db.commit()
id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_
    after = _invoice_snapshot(db, invoice)

    await write_audit_event(
        actor_user_id=actor.id,
        action="INVOICE_APPROVED_FOR_PAYMENT",
        entity_type="invoice",
        entity_id=invoice.id,
        location_id=invoice.location_id,
        before=before,
        after=after,
        payload={},
    )

    return invoice
