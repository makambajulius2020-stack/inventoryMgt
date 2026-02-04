from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.logger import write_audit_event
from app.auth.deps import get_single_role_name
from app.models.finance import SalesRecord
from app.models.rbac import User


def _sales_snapshot(rec: SalesRecord) -> dict[str, Any]:
    return {
        "id": rec.id,
        "location_id": rec.location_id,
        "sales_date": rec.sales_date,
        "department": rec.department,
        "category": rec.category,
        "status": rec.status,
        "amount": float(rec.amount),
        "notes": rec.notes,
    }


async def create_daily_sales_snapshot(
    *,
    db: Session,
    actor: User,
    location_id: int,
    sales_date: date,
    department: str,
    category: str,
    amount: float,
    notes: str,
) -> SalesRecord:
    if amount < 0:
        raise HTTPException(status_code=409, detail="Amount must be >= 0")

    # Hard rule: append-only. If record exists for the unique key, reject.
    exists = db.execute(
        select(SalesRecord.id).where(
            SalesRecord.location_id == location_id,
            SalesRecord.sales_date == sales_date,
            SalesRecord.department == department,
            SalesRecord.category == category,
        )
    ).first()
    if exists is not None:
        raise HTTPException(status_code=409, detail="Sales snapshot already exists for this key")

    rec = SalesRecord(
        location_id=location_id,
        sales_date=sales_date,
        department=department,
        category=category,
        status="POSTED",
        amount=float(amount),
        notes=notes,
        created_by_user_id=actor.id,
    )

    db.add(rec)
    db.commit()

    after = _sales_snapshot(rec)
    await write_audit_event(
        actor_user_id=actor.id,
        actor_email=actor.username,
        actor_role=get_single_role_name(db, actor.id),
        actor_department_id=actor.department_id,
        action="SALES_SNAPSHOT_CREATED",
        entity_type="sales_record",
        entity_id=rec.id,
        location_id=rec.location_id,
        before=None,
        after=after,
        payload={},
    )

    return rec


def query_sales(
    *,
    db: Session,
    location_id: int,
    from_date: date | None = None,
    to_date: date | None = None,
    department: str | None = None,
    category: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[dict[str, Any]]:
    if limit <= 0 or limit > 1000:
        raise HTTPException(status_code=409, detail="limit must be between 1 and 1000")
    if offset < 0:
        raise HTTPException(status_code=409, detail="offset must be >= 0")

    stmt = select(SalesRecord).where(SalesRecord.location_id == location_id)

    if from_date is not None:
        stmt = stmt.where(SalesRecord.sales_date >= from_date)
    if to_date is not None:
        stmt = stmt.where(SalesRecord.sales_date <= to_date)
    if department is not None:
        stmt = stmt.where(SalesRecord.department == department)
    if category is not None:
        stmt = stmt.where(SalesRecord.category == category)

    stmt = stmt.order_by(SalesRecord.sales_date.asc(), SalesRecord.department.asc(), SalesRecord.category.asc(), SalesRecord.id.asc())
    stmt = stmt.offset(int(offset)).limit(int(limit))

    rows = db.execute(stmt).scalars().all()
    return [_sales_snapshot(r) for r in rows]
