from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.deps import forbid_role, require_permission, resolve_effective_location_id
from app.db.deps import get_db
from app.models.rbac import User
from app.rbac.permissions import CREATE_SALES, VIEW_SALES
from app.services import sales as sales_service

router = APIRouter(prefix="/sales")


class SalesSnapshotCreateIn(BaseModel):
    location_id: int
    sales_date: date
    department: str = ""
    category: str = ""
    amount: float = Field(ge=0)
    notes: str = ""


@router.post("/daily")
async def create_daily_sales_snapshot(
    payload: SalesSnapshotCreateIn,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CREATE_SALES))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    effective_location_id = resolve_effective_location_id(db=db, user=user, requested_location_id=payload.location_id)

    rec = await sales_service.create_daily_sales_snapshot(
        db=db,
        actor=user,
        location_id=effective_location_id,
        sales_date=payload.sales_date,
        department=payload.department,
        category=payload.category,
        amount=payload.amount,
        notes=payload.notes,
    )

    return {"id": rec.id}


@router.get("/query")
def query_sales(
    location_id: int,
    from_date: date | None = None,
    to_date: date | None = None,
    department: str | None = None,
    category: str | None = None,
    limit: int = 200,
    offset: int = 0,
    db: Annotated[Session, Depends(get_db)] = Depends(get_db),
    user: Annotated[User, Depends(require_permission(VIEW_SALES))] = Depends(require_permission(VIEW_SALES)),
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = Depends(forbid_role("BRANCH_MANAGER")),
):
    effective_location_id = resolve_effective_location_id(db=db, user=user, requested_location_id=location_id)

    return {
        "location_id": effective_location_id,
        "from_date": from_date,
        "to_date": to_date,
        "department": department,
        "category": category,
        "rows": sales_service.query_sales(
            db=db,
            location_id=effective_location_id,
            from_date=from_date,
            to_date=to_date,
            department=department,
            category=category,
            limit=limit,
            offset=offset,
        ),
    }
