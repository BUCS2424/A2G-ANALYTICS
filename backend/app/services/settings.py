from pymongo.database import Database


def get_setting(db: Database, key: str, default: str | None = None) -> str | None:
    doc = db.settings.find_one({"_id": key})
    return doc["value"] if doc else default


def get_all_settings(db: Database) -> dict[str, str | None]:
    return {s["_id"]: s["value"] for s in db.settings.find()}
