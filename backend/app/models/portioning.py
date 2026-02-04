from __future__ import annotations

from sqlalchemy import CheckConstraint, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TransactionalMixin


class PortioningBatch(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "portioning_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    notes: Mapped[str] = mapped_column(String(500), default="", nullable=False)


Index("ix_portioning_batches_location_status_created_at", PortioningBatch.location_id, PortioningBatch.status, PortioningBatch.created_at)
Index("ix_portioning_batches_created_by", PortioningBatch.created_by_user_id)


class PortioningInputLine(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "portioning_input_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("portioning_batches.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")

    __table_args__ = (CheckConstraint("quantity > 0", name="ck_portioning_input_qty_gt_zero"),)


Index("ix_portioning_input_lines_batch", PortioningInputLine.batch_id)
Index("ix_portioning_input_lines_item", PortioningInputLine.item_id)


class PortioningOutputLine(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "portioning_output_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("portioning_batches.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")

    __table_args__ = (CheckConstraint("quantity > 0", name="ck_portioning_output_qty_gt_zero"),)


Index("ix_portioning_output_lines_batch", PortioningOutputLine.batch_id)
Index("ix_portioning_output_lines_item", PortioningOutputLine.item_id)


class PortioningLossLine(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "portioning_loss_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("portioning_batches.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")

    __table_args__ = (CheckConstraint("quantity > 0", name="ck_portioning_loss_qty_gt_zero"),)


Index("ix_portioning_loss_lines_batch", PortioningLossLine.batch_id)
Index("ix_portioning_loss_lines_item", PortioningLossLine.item_id)
