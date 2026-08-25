"""TEMPORARY one-time data migration endpoints — let the already-connected
production server import the real backfilled data over HTTPS (direct MongoDB
TLS connections from the dev machine to Atlas fail for unrelated network
reasons), reset the migrated admin's password, and purge data to recover
from the Atlas free-tier storage quota. Delete this file (and its
include_router line in main.py) once the migration is done; it is not meant
to stay in the app.
"""

from bson import json_util
from fastapi import APIRouter, Header, HTTPException, Request, status
from pymongo.errors import BulkWriteError

from app.database import get_db
from app.security import hash_password

router = APIRouter(prefix="/api/_migrate", tags=["migrate"])

# One-time shared secret for this migration only — not tied to any user
# account, since the whole point is the production DB has no users yet.
MIGRATE_SECRET = "tmp-a2g-migrate-9f3c7b1e4a6d8021"


def _check_secret(x_migrate_secret: str) -> None:
    if x_migrate_secret != MIGRATE_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)


@router.post("/import", status_code=status.HTTP_204_NO_CONTENT)
async def import_batch(request: Request, x_migrate_secret: str = Header(default="")):
    _check_secret(x_migrate_secret)

    body = json_util.loads((await request.body()).decode("utf-8"))
    collection = body["collection"]
    documents = body["documents"]
    reset = body.get("reset", False)

    db = get_db()
    coll = db[collection]
    if reset:
        coll.delete_many({})
    if documents:
        try:
            # unordered so one duplicate (e.g. a retried batch that partially
            # landed before a dropped connection) doesn't block the rest —
            # duplicate _id errors are expected/harmless on retry, anything
            # else should still fail loudly.
            coll.insert_many(documents, ordered=False)
        except BulkWriteError as exc:
            non_duplicate_errors = [e for e in exc.details.get("writeErrors", []) if e.get("code") != 11000]
            if non_duplicate_errors:
                raise


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(request: Request, x_migrate_secret: str = Header(default="")):
    _check_secret(x_migrate_secret)
    body = await request.json()
    db = get_db()
    result = db.users.update_one({"email": body["email"].lower()}, {"$set": {"password": hash_password(body["password"])}})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No user with that email")


@router.post("/purge", status_code=status.HTTP_200_OK)
async def purge(request: Request, x_migrate_secret: str = Header(default="")):
    """Deletes matching documents to free up storage — Atlas still allows
    deletes when a cluster is over its space quota, only inserts/updates
    that grow storage are blocked."""
    _check_secret(x_migrate_secret)
    body = json_util.loads((await request.body()).decode("utf-8"))
    db = get_db()
    result = db[body["collection"]].delete_many(body.get("filter", {}))
    return {"deleted_count": result.deleted_count}


@router.get("/stats", status_code=status.HTTP_200_OK)
async def collection_stats(x_migrate_secret: str = Header(default="")):
    _check_secret(x_migrate_secret)
    db = get_db()
    return {name: db.command("collStats", name).get("size") for name in db.list_collection_names()}
