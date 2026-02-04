from __future__ import annotations

from datetime import date

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TransactionalMixin


class SalesRecord(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "sales_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)

    sales_date: Mapped[date] = mapped_column(nullable=False)
    department: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    category: Mapped[str] = mapped_column(String(120), default="", nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="POSTED")
    amount: Mapped[float] = mapped_column(nullable=False)
    notes: Mapped[str] = mapped_column(String(500), default="", nullable=False)

    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_sales_amount_ge_zero"),
        UniqueConstraint("location_id", "sales_date", "department", "category", name="uq_sales_location_date_dept_category"),
    )


Index("ix_sales_location_date", SalesRecord.location_id, SalesRecord.sales_date)
Index("ix_sales_location_status_created_at", SalesRecord.location_id, SalesRecord.status, SalesRecord.created_at)
Index("ix_sales_created_by", SalesRecord.created_by_user_id)


class PettyCashTransaction(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "petty_cash_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)

    txn_date: Mapped[date] = mapped_column(nullable=False)
    vendor_name: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="", nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    amount: Mapped[float] = mapped_column(nullable=False)
    method: Mapped[str] = mapped_column(String(40), default="CASH", nullable=False)
    reference: Mapped[str] = mapped_column(String(120), default="", nullable=False)

    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_petty_amount_ge_zero"),
    )


Index("ix_petty_location_date", PettyCashTransaction.location_id, PettyCashTransaction.txn_date)
Index("ix_petty_location_status_created_at", PettyCashTransaction.location_id, PettyCashTransaction.status, PettyCashTransaction.created_at)
Index("ix_petty_created_by", PettyCashTransaction.created_by_user_id)


class PettyCashLine(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "petty_cash_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    petty_cash_txn_id: Mapped[int] = mapped_column(ForeignKey("petty_cash_transactions.id"), nullable=False)

    description: Mapped[str] = mapped_column(String(500), default="", nullable=False)

    # Optional stock linkage. If item_id is present, quantity must be > 0.
    item_id: Mapped[int | None] = mapped_column(ForeignKey("items.id"))
    quantity: Mapped[float] = mapped_column(nullable=False, default=0.0)
    unit_price: Mapped[float] = mapped_column(nullable=False, default=0.0)

    amount: Mapped[float] = mapped_column(nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")

    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_petty_line_amount_ge_zero"),
        CheckConstraint("quantity >= 0", name="ck_petty_line_qty_ge_zero"),
        CheckConstraint("unit_price >= 0", name="ck_petty_line_unit_price_ge_zero"),
    )


Index("ix_petty_lines_txn", PettyCashLine.petty_cash_txn_id)
Index("ix_petty_lines_item", PettyCashLine.item_id)
