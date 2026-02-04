from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.pricing import PriceAlert, PriceObservation
from app.models.procurement import GRN, GRNLine, LPO
from app.models.rbac import User


SOURCE_TYPE_GRN = "GRN"


def _observation_snapshot(obs: PriceObservation) -> dict[str, Any]:
    return {
        "id": obs.id,
        "location_id": obs.location_id,
        "vendor_id": obs.vendor_id,
        "item_id": obs.item_id,
        "unit_price": float(obs.unit_price),
        "quantity": float(obs.quantity),
        "status": obs.status,
        "source_document_type": obs.source_document_type,
        "source_document_id": obs.source_document_id,
        "grn_id": obs.grn_id,
        "grn_line_id": obs.grn_line_id,
        "notes": obs.notes,
        "created_by_user_id": obs.created_by_user_id,
    }


def _alert_snapshot(alert: PriceAlert) -> dict[str, Any]:
    return {
        "id": alert.id,
        "location_id": alert.location_id,
        "vendor_id": alert.vendor_id,
        "item_id": alert.item_id,
        "observation_id": alert.observation_id,
        "status": alert.status,
        "severity": alert.severity,
        "threshold_pct": float(alert.threshold_pct),
        "baseline_unit_price": float(alert.baseline_unit_price),
        "observed_unit_price": float(alert.observed_unit_price),
        "pct_change": float(alert.pct_change),
        "reason": alert.reason,
        "created_by_user_id": alert.created_by_user_id,
    }


def _pct_change(*, baseline: float, observed: float) -> float:
    if float(baseline) <= 0:
        raise HTTPException(status_code=409, detail="Baseline must be > 0")
    return (float(observed) - float(baseline)) / float(baseline) * 100.0


def _severity_for_pct(*, pct_change_abs: float) -> str:
    # Deterministic: severity bands derived from pct absolute.
    if pct_change_abs >= 50.0:
        return "CRITICAL"
    if pct_change_abs >= 25.0:
        return "HIGH"
    return "MEDIUM"


def _default_threshold_pct() -> float:
    # Deterministic default threshold if no configuration exists.
    return 15.0


def compute_rolling_baseline_unit_price(
    *,
    db: Session,
    location_id: int,
    vendor_id: int | None,
    item_id: int,
    window_n: int = 10,
) -> float | None:
    if window_n <= 0:
        raise HTTPException(status_code=409, detail="window_n must be > 0")

    stmt = (
        select(PriceObservation.unit_price)
        .where(
            PriceObservation.location_id == location_id,
            PriceObservation.item_id == item_id,
        )
        .order_by(PriceObservation.created_at.desc(), PriceObservation.id.desc())
        .limit(int(window_n))
    )

    if vendor_id is None:
        stmt = stmt.where(PriceObservation.vendor_id.is_(None))
    else:
        stmt = stmt.where(PriceObservation.vendor_id == vendor_id)

    values = [float(r[0]) for r in db.execute(stmt).all()]
    if not values:
        return None

    # Deterministic baseline: simple mean.
    return float(sum(values)) / float(len(values))


async def record_price_observations_from_grn_finance_confirm(
    *,
    db: Session,
    actor: User,
    grn_id: int,
    commit: bool = True,
) -> dict[str, Any]:
    grn = db.get(GRN, grn_id)
    if grn is None:
        raise HTTPException(status_code=404, detail="GRN not found")

    if grn.status != "FINANCE_CONFIRMED":
        raise HTTPException(status_code=409, detail="Price observations can be recorded only on GRN FINANCE_CONFIRMED")

    lpo = db.get(LPO, grn.lpo_id)
    if lpo is None:
        raise HTTPException(status_code=500, detail="LPO missing for GRN")

    vendor_id = int(lpo.vendor_id) if getattr(lpo, "vendor_id", None) is not None else None

    lines = db.execute(select(GRNLine).where(GRNLine.grn_id == grn.id)).scalars().all()
    if not lines:
        raise HTTPException(status_code=409, detail="GRN has no lines")

    created_observations: list[PriceObservation] = []
    created_alerts: list[PriceAlert] = []
    pending_alert_audits: list[dict[str, Any]] = []

    threshold_pct = _default_threshold_pct()

    for line in lines:
        existing = db.execute(
            select(PriceObservation.id).where(
                PriceObservation.source_document_type == SOURCE_TYPE_GRN,
                PriceObservation.source_document_id == grn.id,
                PriceObservation.item_id == line.item_id,
            )
        ).first()
        if existing is not None:
            # Deterministic idempotency: if already recorded for this key, skip.
            continue

        obs = PriceObservation(
            location_id=grn.location_id,
            vendor_id=vendor_id,
            item_id=line.item_id,
            unit_price=float(line.unit_price),
            quantity=float(line.received_qty),
            status="ACTIVE",
            source_document_type=SOURCE_TYPE_GRN,
            source_document_id=grn.id,
            grn_id=grn.id,
            grn_line_id=line.id,
            notes="",
            created_by_user_id=actor.id,
        )
        db.add(obs)
        db.flush()
        created_observations.append(obs)

        # Deterministic and explainable baseline: simple mean of up to N prior observations
        # (excluding the current observation).
        prior_stmt = (
            select(PriceObservation.unit_price)
            .where(
                PriceObservation.location_id == grn.location_id,
                PriceObservation.item_id == line.item_id,
                PriceObservation.id != obs.id,
            )
            .order_by(PriceObservation.created_at.desc(), PriceObservation.id.desc())
            .limit(10)
        )
        if vendor_id is None:
            prior_stmt = prior_stmt.where(PriceObservation.vendor_id.is_(None))
        else:
            prior_stmt = prior_stmt.where(PriceObservation.vendor_id == vendor_id)

        prior_values = [float(r[0]) for r in db.execute(prior_stmt).all()]
        prior_baseline = None
        if prior_values:
            prior_baseline = float(sum(prior_values)) / float(len(prior_values))

        if prior_baseline is None:
            continue

        pct = _pct_change(baseline=prior_baseline, observed=float(line.unit_price))
        if abs(float(pct)) < float(threshold_pct):
            continue

        alert = PriceAlert(
            location_id=grn.location_id,
            vendor_id=vendor_id,
            item_id=line.item_id,
            observation_id=obs.id,
            status="OPEN",
            severity=_severity_for_pct(pct_change_abs=abs(float(pct))),
            threshold_pct=float(threshold_pct),
            baseline_unit_price=float(prior_baseline),
            observed_unit_price=float(line.unit_price),
            pct_change=float(pct),
            reason=f"Unit price variance {pct:.2f}% vs rolling baseline (n<=10) after GRN finance-confirm.",
            created_by_user_id=actor.id,
        )
        db.add(alert)
        db.flush()
        created_alerts.append(alert)

        pending_alert_audits.append(
            {
                "entity_id": alert.id,
                "location_id": alert.location_id,
                "after": _alert_snapshot(alert),
                "payload": {
                    "observation": _observation_snapshot(obs),
                    "threshold_pct": float(threshold_pct),
                    "baseline_n_max": 10,
                },
            }
        )

    if commit:
        db.commit()

    return {
        "grn_id": grn.id,
        "observations_created": len(created_observations),
        "alerts_created": len(created_alerts),
        "pending_alert_audits": pending_alert_audits,
    }


def query_price_history(
    *,
    db: Session,
    location_id: int,
    item_id: int | None = None,
    vendor_id: int | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[dict[str, Any]]:
    if limit <= 0 or limit > 1000:
        raise HTTPException(status_code=409, detail="limit must be between 1 and 1000")
    if offset < 0:
        raise HTTPException(status_code=409, detail="offset must be >= 0")

    stmt = select(PriceObservation).where(PriceObservation.location_id == location_id)
    if item_id is not None:
        stmt = stmt.where(PriceObservation.item_id == item_id)
    if vendor_id is not None:
        stmt = stmt.where(PriceObservation.vendor_id == vendor_id)

    stmt = stmt.order_by(PriceObservation.created_at.desc(), PriceObservation.id.desc()).offset(int(offset)).limit(int(limit))
    rows = db.execute(stmt).scalars().all()
    return [_observation_snapshot(r) for r in rows]


def query_price_alerts(
    *,
    db: Session,
    location_id: int,
    status: str | None = None,
    item_id: int | None = None,
    vendor_id: int | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[dict[str, Any]]:
    if limit <= 0 or limit > 1000:
        raise HTTPException(status_code=409, detail="limit must be between 1 and 1000")
    if offset < 0:
        raise HTTPException(status_code=409, detail="offset must be >= 0")

    stmt = select(PriceAlert).where(PriceAlert.location_id == location_id)
    if status is not None:
        stmt = stmt.where(PriceAlert.status == status)
    if item_id is not None:
        stmt = stmt.where(PriceAlert.item_id == item_id)
    if vendor_id is not None:
        stmt = stmt.where(PriceAlert.vendor_id == vendor_id)

    stmt = stmt.order_by(PriceAlert.created_at.desc(), PriceAlert.id.desc()).offset(int(offset)).limit(int(limit))
    rows = db.execute(stmt).scalars().all()
    return [_alert_snapshot(r) for r in rows]


def query_vendor_outliers(
    *,
    db: Session,
    location_id: int,
    vendor_id: int,
    threshold_pct: float | None = None,
    window_n: int = 10,
    limit: int = 200,
) -> list[dict[str, Any]]:
    if window_n <= 0:
        raise HTTPException(status_code=409, detail="window_n must be > 0")
    if limit <= 0 or limit > 1000:
        raise HTTPException(status_code=409, detail="limit must be between 1 and 1000")

    thresh = float(threshold_pct) if threshold_pct is not None else _default_threshold_pct()

    # Deterministic outlier definition: compare each item latest obs to its rolling baseline.
    latest_stmt = (
        select(
            PriceObservation.item_id,
            func.max(PriceObservation.id).label("max_id"),
        )
        .where(
            PriceObservation.location_id == location_id,
            PriceObservation.vendor_id == vendor_id,
        )
        .group_by(PriceObservation.item_id)
    )

    latest_ids = [int(r.max_id) for r in db.execute(latest_stmt).all()]
    if not latest_ids:
        return []

    obs_rows = db.execute(select(PriceObservation).where(PriceObservation.id.in_(latest_ids))).scalars().all()

    results: list[dict[str, Any]] = []
    for obs in obs_rows:
        baseline = compute_rolling_baseline_unit_price(
            db=db,
            location_id=location_id,
            vendor_id=vendor_id,
            item_id=obs.item_id,
            window_n=window_n,
        )
        if baseline is None:
            continue
        pct = _pct_change(baseline=float(baseline), observed=float(obs.unit_price))
        if abs(float(pct)) < float(thresh):
            continue

        results.append(
            {
                "item_id": obs.item_id,
                "vendor_id": vendor_id,
                "location_id": location_id,
                "baseline_unit_price": float(baseline),
                "observed_unit_price": float(obs.unit_price),
                "pct_change": float(pct),
                "threshold_pct": float(thresh),
                "observation_id": obs.id,
            }
        )

    results.sort(key=lambda x: abs(float(x["pct_change"])), reverse=True)
    return results[: int(limit)]
