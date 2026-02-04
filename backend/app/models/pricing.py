from __future__ import annotations

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TransactionalMixin


class PriceObservation(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "price_observations"

    id: Mapped[int] = mapped_column(primary_key=True)

    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id"))
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)

    unit_price: Mapped[float] = mapped_column(nullable=False)
    quantity: Mapped[float] = mapped_column(nullable=False, default=0.0)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")

    source_document_type: Mapped[str] = mapped_column(String(40), nullable=False)
    source_document_id: Mapped[int] = mapped_column(nullable=False)

    grn_id: Mapped[int | None] = mapped_column(ForeignKey("grns.id"))
    grn_line_id: Mapped[int | None] = mapped_column(ForeignKey("grn_lines.id"))

    notes: Mapped[str] = mapped_column(String(500), default="", nullable=False)

    __table_args__ = (
        CheckConstraint("unit_price >= 0", name="ck_price_obs_unit_price_ge_zero"),
        CheckConstraint("quantity >= 0", name="ck_price_obs_qty_ge_zero"),
        UniqueConstraint(
            "source_document_type",
            "source_document_id",
            "item_id",
            name="uq_price_obs_source_item",
        ),
    )


Index("ix_price_obs_location_item_created_at", PriceObservation.location_id, PriceObservation.item_id, PriceObservation.created_at)
Index("ix_price_obs_location_vendor_item_created_at", PriceObservation.location_id, PriceObservation.vendor_id, PriceObservation.item_id, PriceObservation.created_at)
Index("ix_price_obs_grn", PriceObservation.grn_id)


class PriceAlert(Base, TimestampMixin, TransactionalMixin):
    __tablename__ = "price_alerts"

    id: Mapped[int] = mapped_column(primary_key=True)

    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id"))
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)

    observation_id: Mapped[int] = mapped_column(ForeignKey("price_observations.id"), nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="OPEN")
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="MEDIUM")

    threshold_pct: Mapped[float] = mapped_column(nullable=False)
    baseline_unit_price: Mapped[float] = mapped_column(nullable=False)
    observed_unit_price: Mapped[float] = mapped_column(nullable=False)
    pct_change: Mapped[float] = mapped_column(nullable=False)

    reason: Mapped[str] = mapped_column(String(500), default="", nullable=False)

    __table_args__ = (
        UniqueConstraint("observation_id", name="uq_price_alert_observation"),
    )


Index("ix_price_alerts_location_status_created_at", PriceAlert.location_id, PriceAlert.status, PriceAlert.created_at)
Index("ix_price_alerts_location_item_created_at", PriceAlert.location_id, PriceAlert.item_id, PriceAlert.created_at)
Index("ix_price_alerts_location_vendor_created_at", PriceAlert.location_id, PriceAlert.vendor_id, PriceAlert.created_at)
