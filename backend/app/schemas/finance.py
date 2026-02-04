from __future__ import annotations

from pydantic import BaseModel, Field


class InvoiceLineIn(BaseModel):
    item_id: int
    billed_qty: float = Field(ge=0)
    unit_price: float = Field(ge=0)


class InvoiceCreateIn(BaseModel):
    grn_id: int
    vendor_invoice_number: str
    notes: str = ""
    lines: list[InvoiceLineIn]


class PaymentCreateIn(BaseModel):
    invoice_id: int
    amount: float = Field(gt=0)
    method: str = ""
    reference: str = ""
