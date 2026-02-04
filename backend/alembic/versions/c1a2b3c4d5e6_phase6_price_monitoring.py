"""phase6_price_monitoring

Revision ID: c1a2b3c4d5e6
Revises: 5c448eddb9ca
Create Date: 2026-01-31 21:40:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'c1a2b3c4d5e6'
down_revision = '5c448eddb9ca'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not inspector.has_table('price_observations'):
        op.create_table(
            'price_observations',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('location_id', sa.Integer(), nullable=False),
            sa.Column('vendor_id', sa.Integer(), nullable=True),
            sa.Column('item_id', sa.Integer(), nullable=False),
            sa.Column('unit_price', sa.Float(), nullable=False),
            sa.Column('quantity', sa.Float(), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('source_document_type', sa.String(length=40), nullable=False),
            sa.Column('source_document_id', sa.Integer(), nullable=False),
            sa.Column('grn_id', sa.Integer(), nullable=True),
            sa.Column('grn_line_id', sa.Integer(), nullable=True),
            sa.Column('notes', sa.String(length=500), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.Column('created_by_user_id', sa.Integer(), nullable=False),
            sa.CheckConstraint('quantity >= 0', name='ck_price_obs_qty_ge_zero'),
            sa.CheckConstraint('unit_price >= 0', name='ck_price_obs_unit_price_ge_zero'),
            sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id']),
            sa.ForeignKeyConstraint(['grn_id'], ['grns.id']),
            sa.ForeignKeyConstraint(['grn_line_id'], ['grn_lines.id']),
            sa.ForeignKeyConstraint(['item_id'], ['items.id']),
            sa.ForeignKeyConstraint(['location_id'], ['locations.id']),
            sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('source_document_type', 'source_document_id', 'item_id', name='uq_price_obs_source_item'),
        )

    existing_indexes = {ix.get('name') for ix in inspector.get_indexes('price_observations')} if inspector.has_table('price_observations') else set()
    if 'ix_price_obs_location_item_created_at' not in existing_indexes:
        op.create_index('ix_price_obs_location_item_created_at', 'price_observations', ['location_id', 'item_id', 'created_at'], unique=False)
    if 'ix_price_obs_location_vendor_item_created_at' not in existing_indexes:
        op.create_index('ix_price_obs_location_vendor_item_created_at', 'price_observations', ['location_id', 'vendor_id', 'item_id', 'created_at'], unique=False)
    if 'ix_price_obs_grn' not in existing_indexes:
        op.create_index('ix_price_obs_grn', 'price_observations', ['grn_id'], unique=False)

    if not inspector.has_table('price_alerts'):
        op.create_table(
            'price_alerts',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('location_id', sa.Integer(), nullable=False),
            sa.Column('vendor_id', sa.Integer(), nullable=True),
            sa.Column('item_id', sa.Integer(), nullable=False),
            sa.Column('observation_id', sa.Integer(), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('severity', sa.String(length=20), nullable=False),
            sa.Column('threshold_pct', sa.Float(), nullable=False),
            sa.Column('baseline_unit_price', sa.Float(), nullable=False),
            sa.Column('observed_unit_price', sa.Float(), nullable=False),
            sa.Column('pct_change', sa.Float(), nullable=False),
            sa.Column('reason', sa.String(length=500), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.Column('created_by_user_id', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id']),
            sa.ForeignKeyConstraint(['item_id'], ['items.id']),
            sa.ForeignKeyConstraint(['location_id'], ['locations.id']),
            sa.ForeignKeyConstraint(['observation_id'], ['price_observations.id']),
            sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('observation_id', name='uq_price_alert_observation'),
        )

    existing_alert_indexes = {ix.get('name') for ix in inspector.get_indexes('price_alerts')} if inspector.has_table('price_alerts') else set()
    if 'ix_price_alerts_location_status_created_at' not in existing_alert_indexes:
        op.create_index('ix_price_alerts_location_status_created_at', 'price_alerts', ['location_id', 'status', 'created_at'], unique=False)
    if 'ix_price_alerts_location_item_created_at' not in existing_alert_indexes:
        op.create_index('ix_price_alerts_location_item_created_at', 'price_alerts', ['location_id', 'item_id', 'created_at'], unique=False)
    if 'ix_price_alerts_location_vendor_created_at' not in existing_alert_indexes:
        op.create_index('ix_price_alerts_location_vendor_created_at', 'price_alerts', ['location_id', 'vendor_id', 'created_at'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if inspector.has_table('price_alerts'):
        existing_indexes = {ix.get('name') for ix in inspector.get_indexes('price_alerts')}
        if 'ix_price_alerts_location_vendor_created_at' in existing_indexes:
            op.drop_index('ix_price_alerts_location_vendor_created_at', table_name='price_alerts')
        if 'ix_price_alerts_location_item_created_at' in existing_indexes:
            op.drop_index('ix_price_alerts_location_item_created_at', table_name='price_alerts')
        if 'ix_price_alerts_location_status_created_at' in existing_indexes:
            op.drop_index('ix_price_alerts_location_status_created_at', table_name='price_alerts')
        op.drop_table('price_alerts')

    if inspector.has_table('price_observations'):
        existing_indexes = {ix.get('name') for ix in inspector.get_indexes('price_observations')}
        if 'ix_price_obs_grn' in existing_indexes:
            op.drop_index('ix_price_obs_grn', table_name='price_observations')
        if 'ix_price_obs_location_vendor_item_created_at' in existing_indexes:
            op.drop_index('ix_price_obs_location_vendor_item_created_at', table_name='price_observations')
        if 'ix_price_obs_location_item_created_at' in existing_indexes:
            op.drop_index('ix_price_obs_location_item_created_at', table_name='price_observations')
        op.drop_table('price_observations')
