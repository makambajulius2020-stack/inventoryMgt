"""prrd_branch_codes_and_user_department

Revision ID: f0f1c2d3e4f5
Revises: c1a2b3c4d5e6
Create Date: 2026-02-03

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f0f1c2d3e4f5"
down_revision = "c1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("locations", sa.Column("code", sa.String(length=20), nullable=True))
    op.create_unique_constraint("uq_locations_code", "locations", ["code"])

    op.add_column("users", sa.Column("department_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_users_department_id_departments",
        "users",
        "departments",
        ["department_id"],
        ["id"],
    )
    op.create_index("ix_users_department", "users", ["department_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_department", table_name="users")
    op.drop_constraint("fk_users_department_id_departments", "users", type_="foreignkey")
    op.drop_column("users", "department_id")

    op.drop_constraint("uq_locations_code", "locations", type_="unique")
    op.drop_column("locations", "code")
