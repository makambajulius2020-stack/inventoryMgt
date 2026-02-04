from __future__ import annotations

import enum


class RequisitionStatus(str, enum.Enum):
    PENDING = "PENDING"  # submitted by staff
    REVIEWED = "REVIEWED"  # dept head review
    APPROVED = "APPROVED"  # GM approval
    REJECTED = "REJECTED"


class LPOStatus(str, enum.Enum):
    ISSUED = "ISSUED"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    FULLY_RECEIVED = "FULLY_RECEIVED"
    CANCELLED = "CANCELLED"


class GRNStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"  # store + delivery sign
    FINANCE_CONFIRMED = "FINANCE_CONFIRMED"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    MATCHED = "MATCHED"  # three-way match ok
    DISCREPANCY = "DISCREPANCY"
    APPROVED_FOR_PAYMENT = "APPROVED_FOR_PAYMENT"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    SCHEDULED = "SCHEDULED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class InventoryMovementType(str, enum.Enum):
    RECEIPT = "RECEIPT"  # from GRN
    ISSUE = "ISSUE"  # to department
    TRANSFER = "TRANSFER"  # store/butcher/etc
    ADJUSTMENT = "ADJUSTMENT"  # wastage, correction
    PORTIONING = "PORTIONING"  # transformation (raw -> portions)
