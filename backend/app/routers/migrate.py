"""TEMPORARY one-time data migration endpoint — lets the already-connected
production server import the real backfilled data over HTTPS, since direct
MongoDB TLS connections from the dev machine to Atlas are failing for
unrelated network reasons. Delete this file (and its include_router line in
main.py) once the migration is done; it is not meant to stay in the app.
"""

from bson import json_util
from fastapi import APIRouter, Header, HTTPException, Request, status
from pymongo.errors import BulkWriteError

from app.database import get_db

router = APIRouter(prefix="/api/_migrate", tags=["migrate"])

# One-time shared secret for this migration only — not tied to any user
# account, since the whole point is the production DB has no users yet.
MIGRATE_SECRET = "tmp-a2g-migrate-9f3c7b1e4a6d8021"


@router.post("/import", status_code=status.HTTP_204_NO_CONTENT)
async def import_batch(request: Request, x_migrate_secret: str = Header(default="")):
    if x_migrate_secret != MIGRATE_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

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
