from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.deps import forbid_role, require_permission, resolve_effective_location_id, user_can_access_location
from app.db.deps import get_db
from app.models.rbac import User
from app.rbac.permissions import CONFIRM_PETTY_CASH, CREATE_PETTY_CASH
from app.services import petty_cash as petty_cash_service

router = APIRouter(prefix="/finance")


class PettyCashLineIn(BaseModel):
    description: str = ""
    item_id: int | None = None
    quantity: float = Field(ge=0)
    unit_price: float = Field(ge=0)
    amount: float = Field(ge=0)


class PettyCashCreateIn(BaseModel):
    location_id: int
    txn_date: date
    vendor_name: str = ""
    description: str = ""
    method: str = "CASH"
    reference: str = ""
    lines: list[PettyCashLineIn]


@router.post("/petty-cash")
async def create_petty_cash(
    payload: PettyCashCreateIn,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CREATE_PETTY_CASH))],
):
    effective_location_id = resolve_effective_location_id(db=db, user=user, requested_location_id=payload.location_id)

    txn = await petty_cash_service.create_petty_cash_transaction(
        db=db,
        actor=user,
        location_id=effective_location_id,
        txn_date=payload.txn_date,
        vendor_name=payload.vendor_name,
        description=payload.description,
        method=payload.method,
        reference=payload.reference,
        lines=[l.model_dump() for l in payload.lines],
    )

    return {"id": txn.id, "status": txn.status, "amount": float(txn.amount)}


@router.post("/petty-cash/{txn_id}/confirm")
async def confirm_petty_cash(
    txn_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CONFIRM_PETTY_CASH))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    # Location check is enforced in service via txn lookup + this guard.
    from app.models.finance import PettyCashTransaction

    txn = db.get(PettyCashTransaction, txn_id)
    if txn is None:
        raise HTTPException(status_code=404, detail="Not found")
    if not user_can_access_location(db, user, txn.location_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    txn = await petty_cash_service.confirm_petty_cash_transaction(db=db, actor=user, txn_id=txn_id)
    return {"id": txn.id, "status": txn.status}
