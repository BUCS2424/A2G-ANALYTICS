"""Admin back office. Ported from AdminController.php minus the entire
payment/coupon/tax-rate/plan/license surface, which doesn't apply to a
private, unlimited install (see the rewrite plan's Context section)."""

import datetime
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from pymongo.database import Database

from app.database import get_db
from app.deps import UserDoc, require_admin
from app.mongo_utils import serialize, to_object_id
from app.schemas.admin import AdminUserCreate, AdminUserUpdate, PageCreate, PageUpdate
from app.scheduler import send_monthly_reports
from app.security import generate_api_token, hash_password

UPLOADS_DIR = Path("static/uploads")
ALLOWED_UPLOAD_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg", ".ico", ".gif", ".webp"}

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/dashboard")
def dashboard(db: Database = Depends(get_db)):
    # No Payments/Plans cards — this is a private, unlimited install with no
    # billing system (see the rewrite plan's Context section).
    latest_users = [
        serialize({k: v for k, v in u.items() if k not in ("password", "api_token", "tfa_code")})
        for u in db.users.find({"deleted_at": None}).sort("created_at", -1).limit(5)
    ]
    latest_websites = [serialize(w) for w in db.websites.find().sort("created_at", -1).limit(5)]

    return {
        "counts": {
            "users": db.users.count_documents({"deleted_at": None}),
            "pages": db.pages.count_documents({}),
            "websites": db.websites.count_documents({}),
        },
        "latest_users": latest_users,
        "latest_websites": latest_websites,
    }


# --- Users ------------------------------------------------------------------


@router.get("/users")
def list_users(search: str | None = Query(default=None), db: Database = Depends(get_db)):
    query: dict = {"deleted_at": None}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    users = db.users.find(query).sort("created_at", -1)
    return [serialize({k: v for k, v in u.items() if k not in ("password", "api_token", "tfa_code")}) for u in users]


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(payload: AdminUserCreate, db: Database = Depends(get_db)):
    if db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    now = datetime.datetime.utcnow()
    doc = {
        "name": payload.name,
        "email": payload.email.lower(),
        "password": hash_password(payload.password),
        "role": payload.role,
        "email_verified_at": now,
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
    result = db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize({k: v for k, v in doc.items() if k not in ("password", "api_token")})


@router.patch("/users/{user_id}")
def update_user(user_id: str, payload: AdminUserUpdate, db: Database = Depends(get_db)):
    oid = to_object_id(user_id)
    user = db.users.find_one({"_id": oid}) if oid else None
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        raw = data.pop("password")
        if raw:
            data["password"] = hash_password(raw)
        else:
            data.pop("password", None)
    if "email" in data and data["email"]:
        data["email"] = data["email"].lower()

    data["updated_at"] = datetime.datetime.utcnow()
    db.users.update_one({"_id": oid}, {"$set": data})
    updated = db.users.find_one({"_id": oid})
    return serialize({k: v for k, v in updated.items() if k not in ("password", "api_token")})


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, admin: UserDoc = Depends(require_admin), db: Database = Depends(get_db)):
    oid = to_object_id(user_id)
    if oid == admin["_id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")
    result = db.users.update_one({"_id": oid}, {"$set": {"deleted_at": datetime.datetime.utcnow()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")


# --- Websites (admin can see/manage every user's sites) ---------------------


@router.get("/websites")
def list_all_websites(search: str | None = Query(default=None), db: Database = Depends(get_db)):
    query: dict = {}
    if search:
        query["domain"] = {"$regex": search, "$options": "i"}
    sites = list(db.websites.find(query).sort("domain", 1))
    owner_ids = {to_object_id(s["user_id"]) for s in sites if to_object_id(s["user_id"])}
    owners = {u["_id"]: u["email"] for u in db.users.find({"_id": {"$in": list(owner_ids)}})}
    return [
        {**serialize(s), "owner_email": owners.get(to_object_id(s["user_id"]))}
        for s in sites
    ]


@router.delete("/websites/{website_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_website(website_id: str, db: Database = Depends(get_db)):
    oid = to_object_id(website_id)
    website = db.websites.find_one({"_id": oid}) if oid else None
    if website is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Website not found")
    db.websites.delete_one({"_id": oid})
    db.stats.delete_many({"website_id": website_id})
    db.events.delete_many({"website_id": website_id})


# --- Pages (CMS) --------------------------------------------------------------


@router.get("/pages")
def list_pages(db: Database = Depends(get_db)):
    return [serialize(p) for p in db.pages.find().sort("name", 1)]


@router.post("/pages", status_code=status.HTTP_201_CREATED)
def create_page(payload: PageCreate, db: Database = Depends(get_db)):
    now = datetime.datetime.utcnow()
    doc = {**payload.model_dump(), "created_at": now, "updated_at": now}
    result = db.pages.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.patch("/pages/{page_id}")
def update_page(page_id: str, payload: PageUpdate, db: Database = Depends(get_db)):
    oid = to_object_id(page_id)
    page = db.pages.find_one({"_id": oid}) if oid else None
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    data = payload.model_dump(exclude_unset=True)
    data["updated_at"] = datetime.datetime.utcnow()
    db.pages.update_one({"_id": oid}, {"$set": data})
    return serialize(db.pages.find_one({"_id": oid}))


@router.delete("/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_page(page_id: str, db: Database = Depends(get_db)):
    oid = to_object_id(page_id)
    result = db.pages.delete_one({"_id": oid}) if oid else None
    if not result or result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")


# --- Settings (flat key/value store) -----------------------------------------


@router.post("/uploads")
async def upload_asset(file: UploadFile):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    contents = await file.read()
    (UPLOADS_DIR / filename).write_bytes(contents)
    return {"url": f"/static/uploads/{filename}"}


@router.get("/settings")
def get_settings_dict(db: Database = Depends(get_db)):
    return {s["_id"]: s["value"] for s in db.settings.find()}


@router.patch("/settings")
def update_settings(payload: dict[str, str | None], db: Database = Depends(get_db)):
    for key, value in payload.items():
        db.settings.update_one({"_id": key}, {"$set": {"value": value}}, upsert=True)
    return {s["_id"]: s["value"] for s in db.settings.find()}


# --- Reports ------------------------------------------------------------------


@router.post("/reports/run-now")
def run_monthly_reports_now():
    """Manually fires the same batch job the 1st-of-the-month cron trigger
    runs — lets an admin test/force a send without waiting for the actual
    date. Sends to every site with email reports enabled + a client email set."""
    return send_monthly_reports()
