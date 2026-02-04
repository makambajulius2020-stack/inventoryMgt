from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient

from app.settings import settings


mongo_client = AsyncIOMotorClient(settings.mongodb_uri)

def mongo_db():
    return mongo_client[settings.mongodb_db]
