# Key Workflows

## Procurement -> Inventory -> Finance (PRRD)

### Requisition
1. Create requisition (location scoped).
2. Review requisition.
3. Approve requisition.
4. (Optional) Reject paths per workflow rules.

### LPO
1. Create LPO from APPROVED requisition.
2. Cancel LPO only when allowed (e.g., no confirmed receipts).

### GRN
1. Create GRN (DRAFT) with received lines.
2. Store confirm (CONFIRMED).
3. Finance confirm (FINANCE_CONFIRMED).
   - Posts inventory ledger movements.
   - Updates LPO receipt status.
   - Records price observations and creates price alerts if variance exceeds threshold.

### Invoice (Three-way match)
1. Create invoice linked to a finance-confirmed GRN.
2. Evaluate match:
   - compares LPO vs GRN vs Invoice lines.
   - sets invoice status to MATCHED or DISCREPANCY.
3. Approve for payment (only when eligible).

### Payment
1. Create payment (requires invoice APPROVED_FOR_PAYMENT).
2. Schedule payment.
3. Mark paid.
4. Cancel payment (not allowed once PAID).

## Inventory Ledger
- All stock-affecting actions create `InventoryMovement` rows.
- Movements are immutable once posted.

## Petty Cash -> Inventory
1. Create petty cash transaction with one or more lines.
2. Confirm petty cash:
   - Validates header total equals sum(lines).
   - Posts inventory receipt movements only for stock-linked lines.

## Sales Capture
- Daily sales snapshots are append-only records per location/date/department/category.

## Price Monitoring & Variance Detection
- Trigger point: **GRN FINANCE_CONFIRMED only**.
- Observations are stored with provenance (GRN + line).
- Baseline is rolling mean over the last N observations.
- Alerts are single-fire per observation and audited.
