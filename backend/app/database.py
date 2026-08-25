from pymongo import ASCENDING, MongoClient
from pymongo.database import Database

from app.config import get_settings

settings = get_settings()

_client: MongoClient = MongoClient(settings.mongodb_uri)
db: Database = _client[settings.mongodb_db]


def get_db() -> Database:
    return db


def ensure_indexes() -> None:
    """Compound indexes mirroring the original's per-dimension MySQL indexes on
    `stats`/`events`, so dashboard aggregate queries stay fast at scale."""
    db.users.create_index("email", unique=True)
    db.users.create_index("api_token", unique=True, sparse=True)

    db.websites.create_index("domain")
    db.websites.create_index("user_id")

    for dimension in [
        "referrer",
        "page",
        "browser",
        "operating_system",
        "device",
        "continent",
        "country",
        "city",
        "screen_resolution",
        "campaign",
        "language",
    ]:
        db.stats.create_index([("website_id", ASCENDING), ("unique", ASCENDING), ("created_at", ASCENDING), (dimension, ASCENDING)])
    db.stats.create_index([("website_id", ASCENDING), ("created_at", ASCENDING)])

    db.events.create_index([("website_id", ASCENDING), ("created_at", ASCENDING), ("value", ASCENDING)])

    db.pages.create_index("slug")
    db.pending_user_emails.create_index([("user_type", ASCENDING), ("user_id", ASCENDING)])
    db.pending_user_emails.create_index("email")
