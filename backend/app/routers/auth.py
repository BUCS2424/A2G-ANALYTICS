import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pymongo.database import Database

from app.config import get_settings
from app.database import get_db
from app.deps import UserDoc, get_current_user
from app.mongo_utils import serialize
from app.schemas.auth import LoginRequest, RegisterRequest, UserOut
from app.security import generate_api_token, hash_password, sign_session, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


def _set_session_cookie(response: Response, user_id: str) -> None:
    response.set_cookie(
        key="a2g_session",
        value=sign_session(user_id),
        max_age=settings.session_max_age_seconds,
        httponly=True,
        samesite="lax",
        secure=not settings.debug,
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Database = Depends(get_db)):
    existing = db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    is_first_user = db.users.count_documents({}) == 0
    now = datetime.datetime.utcnow()
    user_doc = {
        "name": payload.name,
        "email": payload.email.lower(),
        "password": hash_password(payload.password),
        "role": 1 if is_first_user else 0,  # first account on a fresh install is the admin
        "email_verified_at": now,  # no mail server wired up yet; see Task 6 (settings/mail)
        "avatar": None,
        "api_token": generate_api_token(),
        "locale": None,
        "timezone": None,
        "tfa": None,
        "tfa_code": None,
        "tfa_code_created_at": None,
        "authed_at": None,
        "has_websites": False,
        "can_track_websites": True,
        "website_pageviews_count": 0,
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    result = db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    user_id = str(result.inserted_id)
    _set_session_cookie(response, user_id)
    return serialize(user_doc)


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, response: Response, db: Database = Depends(get_db)):
    user = db.users.find_one({"email": payload.email.lower(), "deleted_at": None})
    if user is None or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    db.users.update_one({"_id": user["_id"]}, {"$set": {"authed_at": datetime.datetime.utcnow()}})

    _set_session_cookie(response, str(user["_id"]))
    return serialize(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie("a2g_session")


@router.get("/me", response_model=UserOut)
def me(user: UserDoc = Depends(get_current_user)):
    return serialize(user)
