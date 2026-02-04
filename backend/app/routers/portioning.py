from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.deps import forbid_role, require_permission, resolve_effective_location_id, user_can_access_location
from app.db.deps import get_db
from app.models.portioning import PortioningBatch
from app.models.rbac import User
from app.rbac.permissions import CONFIRM_PORTIONING, CREATE_PORTIONING
from app.services import portioning as portioning_service

router = APIRouter(prefix="/portioning")


class PortioningLineIn(BaseModel):
    item_id: int
    quantity: float = Field(gt=0)


class PortioningBatchCreateIn(BaseModel):
    location_id: int
    notes: str = ""
    inputs: list[PortioningLineIn]
    outputs: list[PortioningLineIn]
    losses: list[PortioningLineIn] = []


@router.post("/batches")
async def create_batch(
    payload: PortioningBatchCreateIn,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CREATE_PORTIONING))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    effective_location_id = resolve_effective_location_id(db=db, user=user, requested_location_id=payload.location_id)

    batch = await portioning_service.create_batch(
        db=db,
        actor=user,
        location_id=effective_location_id,
        notes=payload.notes,
        inputs=[x.model_dump() for x in payload.inputs],
        outputs=[x.model_dump() for x in payload.outputs],
        losses=[x.model_dump() for x in payload.losses],
    )
    return {"id": batch.id, "status": batch.status}


@router.post("/batches/{batch_id}/confirm")
async def confirm_batch(
    batch_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission(CONFIRM_PORTIONING))],
    _bm_block: Annotated[User, Depends(forbid_role("BRANCH_MANAGER"))] = None,
):
    batch = db.get(PortioningBatch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Not found")
    if not user_can_access_location(db, user, batch.location_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    batch = await portioning_service.confirm_batch(db=db, actor=user, batch_id=batch_id)
    return {"id": batch.id, "status": batch.status}
