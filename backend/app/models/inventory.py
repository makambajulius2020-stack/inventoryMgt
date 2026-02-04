from __future__ import annotations

from datetime import date

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TransactionalMixin
from app.models.enums import InventoryMovementType


class InventoryMovement(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "inventory_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)

    movement_type: Mapped[InventoryMovementType] = mapped_column(String(20), nullable=False)
    quantity: Mapped[float] = mapped_column(nullable=False)
    unit_cost: Mapped[float] = mapped_column(nullable=False, default=0)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="POSTED")

    source_document_type: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    source_document_id: Mapped[int | None]

    # Linkages for traceability
    grn_id: Mapped[int | None] = mapped_column(ForeignKey("grns.id"))
    requisition_id: Mapped[int | None] = mapped_column(ForeignKey("requisitions.id"))

    source_department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    destination_department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))

    batch_ref: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    expiry_date: Mapped[date | None]

    __table_args__ = (
        # ledger rule: movement rows are immutable facts. Corrections should be new ADJUSTMENT rows.
        CheckConstraint("quantity != 0", name="ck_inv_movement_qty_ne_zero"),
        CheckConstraint("unit_cost >= 0", name="ck_inv_movement_unit_cost_ge_zero"),
        UniqueConstraint("id", "location_id", name="uq_inv_movement_location"),
    )


Index(
    "ix_inv_movements_location_item_created_at",
    InventoryMovement.location_id,
    InventoryMovement.item_id,
    InventoryMovement.created_at,
)
Index("ix_inv_movements_location_created_at", InventoryMovement.location_id, InventoryMovement.created_at)
Index("ix_inv_movements_item", InventoryMovement.item_id)
Index("ix_inv_movements_created_by", InventoryMovement.created_by_user_id)
Index(
    "ix_inv_movements_source_doc",
    InventoryMovement.source_document_type,
    InventoryMovement.source_document_id,
)
