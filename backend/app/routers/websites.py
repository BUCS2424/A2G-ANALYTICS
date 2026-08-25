import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse
from pymongo.database import Database

from app.database import get_db
from app.deps import UserDoc, get_current_user
from app.mongo_utils import serialize, to_object_id
from app.schemas.website import WebsiteCreate, WebsiteOut, WebsiteUpdate
from app.security import encrypt_secret
from app.services.mail import send_email
from app.services.reports import build_report_context, previous_month_range, render_report_html
from app.services.stats import count_in_range

router = APIRouter(prefix="/api/websites", tags=["websites"])


def _summary_range(period: Literal["today", "month", "all"]) -> tuple[datetime.date, datetime.date]:
    today = datetime.date.today()
    if period == "today":
        return today, today
    if period == "month":
        return today.replace(day=1), today
    return datetime.date(2000, 1, 1), today


def _get_owned_website(db: Database, website_id: str, user: UserDoc) -> dict:
    oid = to_object_id(website_id)
    website = db.websites.find_one({"_id": oid}) if oid else None
    if website is None or (website["user_id"] != str(user["_id"]) and user.get("role") != 1):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Website not found")
    return website


@router.get("", response_model=list[WebsiteOut])
def list_websites(db: Database = Depends(get_db), user: UserDoc = Depends(get_current_user)):
    sites = db.websites.find({"user_id": str(user["_id"])}).sort("domain", 1)
    return [serialize(site) for site in sites]


@router.post("", response_model=WebsiteOut, status_code=status.HTTP_201_CREATED)
def create_website(payload: WebsiteCreate, db: Database = Depends(get_db), user: UserDoc = Depends(get_current_user)):
    now = datetime.datetime.utcnow()
    website_doc = {
        "domain": payload.domain.lower().removeprefix("www."),
        "user_id": str(user["_id"]),
        "privacy": payload.privacy,
        "password": encrypt_secret(payload.password) if payload.password else None,
        "exclude_bots": payload.exclude_bots,
        "exclude_params": payload.exclude_params,
        "exclude_ips": payload.exclude_ips,
        "email": payload.email,
        "client_emails": payload.client_emails,
        "favorited_at": None,
        "created_at": now,
        "updated_at": now,
    }
    result = db.websites.insert_one(website_doc)
    website_doc["_id"] = result.inserted_id

    if not user.get("has_websites"):
        db.users.update_one({"_id": user["_id"]}, {"$set": {"has_websites": True}})

    return serialize(website_doc)


@router.get("/summary")
def websites_summary(
    period: Literal["today", "month", "all"] = Query(default="today"),
    db: Database = Depends(get_db),
    user: UserDoc = Depends(get_current_user),
):
    """Per-site visitor/pageview counts for the dashboard table — one query per
    site against the same aggregation engine the stats pages use, not a
    separate code path."""
    from_date, to_date = _summary_range(period)
    sites = list(db.websites.find({"user_id": str(user["_id"])}).sort("domain", 1))
    return [
        {
            **serialize(site),
            "visitors": count_in_range(db, str(site["_id"]), from_date, to_date, unique_only=True),
            "pageviews": count_in_range(db, str(site["_id"]), from_date, to_date, unique_only=False),
        }
        for site in sites
    ]


@router.get("/{website_id}", response_model=WebsiteOut)
def get_website(website_id: str, db: Database = Depends(get_db), user: UserDoc = Depends(get_current_user)):
    return serialize(_get_owned_website(db, website_id, user))


@router.patch("/{website_id}", response_model=WebsiteOut)
def update_website(
    website_id: str,
    payload: WebsiteUpdate,
    db: Database = Depends(get_db),
    user: UserDoc = Depends(get_current_user),
):
    website = _get_owned_website(db, website_id, user)
    data = payload.model_dump(exclude_unset=True)

    updates: dict = {}

    if "favorited" in data:
        favorited = data.pop("favorited")
        updates["favorited_at"] = datetime.datetime.utcnow() if favorited else None

    if "password" in data:
        raw_password = data.pop("password")
        updates["password"] = encrypt_secret(raw_password) if raw_password else None

    updates.update(data)
    updates["updated_at"] = datetime.datetime.utcnow()

    db.websites.update_one({"_id": website["_id"]}, {"$set": updates})
    return serialize(db.websites.find_one({"_id": website["_id"]}))


@router.delete("/{website_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_website(website_id: str, db: Database = Depends(get_db), user: UserDoc = Depends(get_current_user)):
    website = _get_owned_website(db, website_id, user)
    db.websites.delete_one({"_id": website["_id"]})

    remaining = db.websites.count_documents({"user_id": str(user["_id"])})
    if remaining == 0:
        db.users.update_one({"_id": user["_id"]}, {"$set": {"has_websites": False}})


def _with_public_link(website: dict, request: Request) -> dict:
    if website.get("privacy") != 0:
        return website
    return {**website, "_public_link": f"{request.url.scheme}://{request.url.netloc}/{website['domain']}"}


@router.get("/{website_id}/report-preview", response_class=HTMLResponse)
def preview_report(website_id: str, request: Request, db: Database = Depends(get_db), user: UserDoc = Depends(get_current_user)):
    website = _with_public_link(_get_owned_website(db, website_id, user), request)
    from_date, to_date = previous_month_range()
    context = build_report_context(db, website, from_date, to_date)
    return render_report_html(context)


@router.post("/{website_id}/send-report", status_code=status.HTTP_204_NO_CONTENT)
def send_report_now(website_id: str, request: Request, db: Database = Depends(get_db), user: UserDoc = Depends(get_current_user)):
    website = _with_public_link(_get_owned_website(db, website_id, user), request)
    recipients = website.get("client_emails") or [user["email"]]

    from_date, to_date = previous_month_range()
    context = build_report_context(db, website, from_date, to_date)
    html = render_report_html(context)

    subject = f"{website['domain']} — {context['month_label']} traffic report"
    for recipient in recipients:
        send_email(db, recipient, subject, html)
