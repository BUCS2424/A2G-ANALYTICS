"""Small helpers for the thin dict-based Mongo layer: no ODM, just plain
pymongo documents with `_id` renamed to `id` (as a string) at the API boundary."""

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId


def to_object_id(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


def serialize(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if doc is None:
        return None
    out = dict(doc)
    out["id"] = str(out.pop("_id"))
    return out
