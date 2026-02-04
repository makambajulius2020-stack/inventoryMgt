from __future__ import annotations

from datetime import date

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, TransactionalMixin
from app.models.enums import GRNStatus, InvoiceStatus, LPOStatus, PaymentStatus, RequisitionStatus


class Requisition(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "requisitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
    requested_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default=RequisitionStatus.PENDING.value)
    notes: Mapped[str] = mapped_column(String(500), default="", nullable=False)


Index("ix_requisitions_location_status_created_at", Requisition.location_id, Requisition.status, Requisition.created_at)
Index("ix_requisitions_department", Requisition.department_id)
Index("ix_requisitions_created_by", Requisition.created_by_user_id)


class RequisitionLine(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "requisition_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    requisition_id: Mapped[int] = mapped_column(ForeignKey("requisitions.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")

    requisition = relationship("Requisition")

    __table_args__ = (CheckConstraint("quantity > 0", name="ck_req_line_qty_gt_zero"),)


Index("ix_requisition_lines_requisition", RequisitionLine.requisition_id)
Index("ix_requisition_lines_item", RequisitionLine.item_id)


class LPO(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "lpos"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    requisition_id: Mapped[int] = mapped_column(ForeignKey("requisitions.id"), nullable=False)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default=LPOStatus.ISSUED.value)
    expected_delivery_date: Mapped[date | None]

    requisition = relationship("Requisition")


Index("ix_lpos_location_status_created_at", LPO.location_id, LPO.status, LPO.created_at)
Index("ix_lpos_vendor", LPO.vendor_id)
Index("ix_lpos_requisition", LPO.requisition_id)
Index("ix_lpos_created_by", LPO.created_by_user_id)


class LPOLine(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "lpo_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    lpo_id: Mapped[int] = mapped_column(ForeignKey("lpos.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)

    ordered_qty: Mapped[float] = mapped_column(nullable=False)
    unit_price: Mapped[float] = mapped_column(nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")

    __table_args__ = (
        CheckConstraint("ordered_qty > 0", name="ck_lpo_line_ordered_qty_gt_zero"),
        CheckConstraint("unit_price >= 0", name="ck_lpo_line_unit_price_ge_zero"),
        UniqueConstraint("lpo_id", "item_id", name="uq_lpo_item"),
    )


Index("ix_lpo_lines_lpo", LPOLine.lpo_id)
Index("ix_lpo_lines_item", LPOLine.item_id)


class GRN(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "grns"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    lpo_id: Mapped[int] = mapped_column(ForeignKey("lpos.id"), nullable=False)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default=GRNStatus.DRAFT.value)
    store_signed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    delivery_signed_by_name: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    finance_signed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    notes: Mapped[str] = mapped_column(String(500), default="", nullable=False)

    lpo = relationship("LPO")


Index("ix_grns_location_status_created_at", GRN.location_id, GRN.status, GRN.created_at)
Index("ix_grns_lpo", GRN.lpo_id)
Index("ix_grns_created_by", GRN.created_by_user_id)


class GRNLine(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "grn_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    grn_id: Mapped[int] = mapped_column(ForeignKey("grns.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)

    received_qty: Mapped[float] = mapped_column(nullable=False)
    unit_price: Mapped[float] = mapped_column(nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")

    __table_args__ = (
        CheckConstraint("received_qty >= 0", name="ck_grn_line_received_qty_ge_zero"),
        CheckConstraint("unit_price >= 0", name="ck_grn_line_unit_price_ge_zero"),
        UniqueConstraint("grn_id", "item_id", name="uq_grn_item"),
    )


Index("ix_grn_lines_grn", GRNLine.grn_id)
Index("ix_grn_lines_item", GRNLine.item_id)


class Invoice(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    grn_id: Mapped[int] = mapped_column(ForeignKey("grns.id"), nullable=False)
    vendor_invoice_number: Mapped[str] = mapped_column(String(120), nullable=False)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default=InvoiceStatus.DRAFT.value)
    notes: Mapped[str] = mapped_column(String(500), default="", nullable=False)

    __table_args__ = (UniqueConstraint("grn_id", name="uq_invoice_grn"),)


Index("ix_invoices_location_status_created_at", Invoice.location_id, Invoice.status, Invoice.created_at)
Index("ix_invoices_grn", Invoice.grn_id)
Index("ix_invoices_created_by", Invoice.created_by_user_id)


class InvoiceLine(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "invoice_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)

    billed_qty: Mapped[float] = mapped_column(nullable=False)
    unit_price: Mapped[float] = mapped_column(nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")

    __table_args__ = (
        CheckConstraint("billed_qty >= 0", name="ck_invoice_line_billed_qty_ge_zero"),
        CheckConstraint("unit_price >= 0", name="ck_invoice_line_unit_price_ge_zero"),
        UniqueConstraint("invoice_id", "item_id", name="uq_invoice_item"),
    )


Index("ix_invoice_lines_invoice", InvoiceLine.invoice_id)
Index("ix_invoice_lines_item", InvoiceLine.item_id)


class Payment(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=PaymentStatus.PENDING.value)
    amount: Mapped[float] = mapped_column(nullable=False, default=0.0)
    method: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    reference: Mapped[str] = mapped_column(String(120), default="", nullable=False)

    __table_args__ = (CheckConstraint("amount >= 0", name="ck_payment_amount_ge_zero"),)


Index("ix_payments_location_status_created_at", Payment.location_id, Payment.status, Payment.created_at)
Index("ix_payments_invoice", Payment.invoice_id)
Index("ix_payments_created_by", Payment.created_by_user_id)


# NOTE: Workflow enforcement is implemented at the service/API layer.
# DB-level structure here makes the chain explicit: requisition -> lpo -> grn -> invoice -> payment.
