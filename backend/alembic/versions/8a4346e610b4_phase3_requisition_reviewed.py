"""phase3_requisition_reviewed

Revision ID: 8a4346e610b4
Revises: 656da132c048
Create Date: 2026-01-31 08:34:53.289174

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8a4346e610b4'
down_revision = '656da132c048'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("UPDATE requisitions SET status='REVIEWED' WHERE status='CONFIRMED'"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("UPDATE requisitions SET status='CONFIRMED' WHERE status='REVIEWED'"))
