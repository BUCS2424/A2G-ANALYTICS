from typing import Any

from fastapi import Cookie, Depends, Header, HTTPException, status
from pymongo.database import Database

from app.config import get_settings
from app.database import get_db
from app.mongo_utils import to_object_id
from app.security import unsign_session

settings = get_settings()

UserDoc = dict[str, Any]


def _load_session_user(db: Database, cookie_value: str | None) -> UserDoc | None:
    if not cookie_value:
        return None
    user_id = unsign_session(cookie_value, max_age=settings.session_max_age_seconds)
    if user_id is None:
        return None
    oid = to_object_id(user_id)
    if oid is None:
        return None
    return db.users.find_one({"_id": oid})


async def get_current_user(
    db: Database = Depends(get_db),
    a2g_session: str | None = Cookie(default=None),
) -> UserDoc:
    user = _load_session_user(db, a2g_session)
    if user is None or user.get("deleted_at") is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


async def get_current_user_optional(
    db: Database = Depends(get_db),
    a2g_session: str | None = Cookie(default=None),
) -> UserDoc | None:
    return _load_session_user(db, a2g_session)


async def require_admin(user: UserDoc = Depends(get_current_user)) -> UserDoc:
    if user.get("role") != 1:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


async def require_api_token_user(
    db: Database = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> UserDoc:
    """Bearer-token auth for the developer REST API (/api/v1/*), matching the
    original's api_token-guarded routes."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    user = db.users.find_one({"api_token": token, "deleted_at": None})
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API token")
    return user
