from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.logger import write_audit_event
from app.auth.deps import get_single_role_name
from app.models.finance import PettyCashLine, PettyCashTransaction
from app.models.inventory import InventoryMovement
from app.models.master import Item
from app.models.enums import InventoryMovementType
from app.models.rbac import User

SOURCE_TYPE = "PETTY_CASH"


def _txn_snapshot(db: Session, txn: PettyCashTransaction) -> dict[str, Any]:
    lines_stmt = select(PettyCashLine).where(PettyCashLine.petty_cash_txn_id == txn.id)
    lines = db.execute(lines_stmt).scalars().all()
    return {
        "id": txn.id,
        "location_id": txn.location_id,
        "txn_date": txn.txn_date,
        "vendor_name": txn.vendor_name,
        "description": txn.description,
        "status": txn.status,
        "amount": float(txn.amount),
        "method": txn.method,
        "reference": txn.reference,
        "lines": [
            {
                "id": l.id,
                "description": l.description,
                "item_id": l.item_id,
                "quantity": float(l.quantity),
                "unit_price": float(l.unit_price),
                "amount": float(l.amount),
                "status": l.status,
            }
            for l in lines
        ],
    }


def _compute_line_amount(*, item_id: int | None, quantity: float, unit_price: float, amount: float) -> float:
    if item_id is not None:
        return float(quantity) * float(unit_price)
    return float(amount)


async def create_petty_cash_transaction(
    *,
    db: Session,
    actor: User,
    location_id: int,
    txn_date: date,
    vendor_name: str,
    description: str,
    method: str,
    reference: str,
    lines: list[dict[str, Any]],
) -> PettyCashTransaction:
    if not lines:
        raise HTTPException(status_code=409, detail="Petty cash must have at least one line")

    computed_total = 0.0
    prepared_lines: list[dict[str, Any]] = []

    for ln in lines:
        item_id = ln.get("item_id")
        if item_id is not None:
            item = db.get(Item, int(item_id))
            if item is None:
                raise HTTPException(status_code=404, detail="Item not found")

        qty = float(ln.get("quantity", 0.0) or 0.0)
        unit_price = float(ln.get("unit_price", 0.0) or 0.0)
        amount = float(ln.get("amount", 0.0) or 0.0)
        line_desc = str(ln.get("description", "") or "")

        if item_id is not None and qty <= 0:
            raise HTTPException(status_code=409, detail="Stock line quantity must be > 0")
        if qty < 0 or unit_price < 0 or amount < 0:
            raise HTTPException(status_code=409, detail="Negative values are not allowed")

        computed_amount = _compute_line_amount(item_id=item_id, quantity=qty, unit_price=unit_price, amount=amount)
        computed_total += float(computed_amount)

        prepared_lines.append(
            {
                "item_id": int(item_id) if item_id is not None else None,
                "description": line_desc,
                "quantity": qty,
                "unit_price": unit_price,
                "amount": float(computed_amount),
            }
        )

    txn = PettyCashTransaction(
        location_id=location_id,
        txn_date=txn_date,
        vendor_name=vendor_name,
        description=description,
        status="PENDING",
        amount=float(computed_total),
        method=method or "CASH",
        reference=reference,
        created_by_user_id=actor.id,
    )
    db.add(txn)
    db.flush()

    for pl in prepared_lines:
        db.add(
            PettyCashLine(
                petty_cash_txn_id=txn.id,
                description=pl["description"],
                item_id=pl["item_id"],
                quantity=float(pl["quantity"]),
                unit_price=float(pl["unit_price"]),
                amount=float(pl["amount"]),
                status="ACTIVE",
                created_by_user_id=actor.id,
            )
        )

    db.commit()

    after = _txn_snapshot(db, txn)
    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="PETTY_CASH_CREATED",
        entity_type="petty_cash_transaction",
        entity_id=txn.id,
        location_id=txn.location_id,
        before=None,
        after=after,
        payload={},
    )

    return txn


async def confirm_petty_cash_transaction(*, db: Session, actor: User, txn_id: int) -> PettyCashTransaction:
    txn = db.get(PettyCashTransaction, txn_id)
    if txn is None:
        raise HTTPException(status_code=404, detail="Not found")

    # Ledger idempotency: if any movement exists for this txn, block duplicates.
    existing_mv = db.execute(
        select(func.count(InventoryMovement.id)).where(
            InventoryMovement.source_document_type == SOURCE_TYPE,
            InventoryMovement.source_document_id == txn.id,
        )
    ).scalar_one()

    if int(existing_mv or 0) > 0:
        raise HTTPException(status_code=409, detail="Inventory already posted for this petty cash transaction")

    if txn.status == "POSTED":
        return txn

    if txn.status != "PENDING":
        raise HTTPException(status_code=409, detail="Invalid state")

    before = _txn_snapshot(db, txn)

    lines = db.execute(select(PettyCashLine).where(PettyCashLine.petty_cash_txn_id == txn.id)).scalars().all()
    if not lines:
        raise HTTPException(status_code=409, detail="No lines")

    # Recompute total to ensure integrity.
    computed_total = sum(float(l.amount) for l in lines)
    if abs(float(txn.amount) - float(computed_total)) > 1e-6:
        raise HTTPException(status_code=409, detail="Header amount does not match line totals")

    movements_created = 0

    for l in lines:
        if l.item_id is None:
            continue

        item = db.get(Item, int(l.item_id))
        if item is None:
            raise HTTPException(status_code=404, detail="Item not found")

        # Treat is_cogs items as stock-tracked for now.
        if not bool(item.is_cogs):
            continue

        db.add(
            InventoryMovement(
                location_id=txn.location_id,
                item_id=int(l.item_id),
                movement_type=InventoryMovementType.RECEIPT.value,
                quantity=float(l.quantity),
                unit_cost=float(l.unit_price),
                status="POSTED",
                source_document_type=SOURCE_TYPE,
                source_document_id=txn.id,
                grn_id=None,
                requisition_id=None,
                source_department_id=None,
                destination_department_id=None,
                batch_ref="",
                expiry_date=None,
                created_by_user_id=actor.id,
            )
        )
        movements_created += 1

    txn.status = "POSTED"
    db.commit()

    after = _txn_snapshot(db, txn)
    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="PETTY_CASH_CONFIRMED",
        entity_type="petty_cash_transaction",
        entity_id=txn.id,
        location_id=txn.location_id,
        before=before,
        after=after,
        payload={"inventory_movements_created": movements_created},
    )

    return txn
