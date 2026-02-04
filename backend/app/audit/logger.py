from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from app.db.mongo import mongo_db


async def write_audit_event(
    *,
    actor_user_id: Optional[int],
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
    actor_department_id: Optional[int] = None,
    action: str,
    entity_type: str,
    entity_id: Optional[int],
    payload: dict[str, Any],
    before: Optional[dict[str, Any]] = None,
    after: Optional[dict[str, Any]] = None,
    location_id: Optional[int] = None,
) -> None:
    db = mongo_db()
    await db["audit_events"].insert_one(
        {
            "ts": datetime.now(timezone.utc),
            "actor_user_id": actor_user_id,
            "actor_email": actor_email,
            "actor_role": actor_role,
            "actor_department_id": actor_department_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "location_id": location_id,
            "before": before,
            "after": after,
            "payload": payload,
        }
    )
