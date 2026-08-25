"""Stats dashboard API. Ported from StatController.php's ~15 near-identical
dimension pages via the generic engine in services/stats.py, plus overview and
realtime which have their own shape."""

import csv
import datetime
import io
from typing import Any, Literal
from zoneinfo import available_timezones

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pymongo.database import Database

from app.database import get_db
from app.deps import UserDoc, get_current_user_optional
from app.schemas.stats import UnlockRequest
from app.security import decrypt_secret, sign_stats_unlock, stats_unlock_cookie_name, verify_stats_unlock
from app.services.stats import (
    DIMENSIONS,
    count_in_range,
    dimension_breakdown,
    resolve_range,
    time_series,
)

router = APIRouter(prefix="/api/websites/{domain}/stats", tags=["stats"])

STATS_UNLOCK_MAX_AGE = 60 * 60 * 24  # 24h, matches original's session-scoped unlock closely enough


def _get_website(db: Database, domain: str) -> dict[str, Any]:
    website = db.websites.find_one({"domain": domain})
    if website is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Website not found")
    return website


def _is_owner_or_admin(website: dict[str, Any], user: UserDoc | None) -> bool:
    if user is None:
        return False
    return str(website["user_id"]) == str(user["_id"]) or user.get("role") == 1


def _guard(website: dict[str, Any], user: UserDoc | None, request: Request) -> None:
    """Mirrors StatController::guard. Raises 403 for private sites the caller
    doesn't own, or 401 (password_required) for password sites without a valid
    unlock cookie."""
    privacy = website.get("privacy", 0)
    if privacy == 0:
        return
    if _is_owner_or_admin(website, user):
        return
    if privacy == 1:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This website's stats are private")
    if privacy == 2:
        cookie_name = stats_unlock_cookie_name(website["domain"])
        token = request.cookies.get(cookie_name)
        if token and verify_stats_unlock(token, website["domain"], STATS_UNLOCK_MAX_AGE):
            return
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="password_required")


def _user_timezone(user: UserDoc | None) -> str:
    tz = (user or {}).get("timezone")
    if tz and tz in available_timezones():
        return tz
    return "UTC"


@router.post("/unlock", status_code=status.HTTP_204_NO_CONTENT)
def unlock(domain: str, payload: UnlockRequest, response: Response, db: Database = Depends(get_db)):
    website = _get_website(db, domain)
    if website.get("privacy") != 2 or not website.get("password"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This website is not password-protected")
    if decrypt_secret(website["password"]) != payload.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")

    response.set_cookie(
        key=stats_unlock_cookie_name(domain),
        value=sign_stats_unlock(domain),
        max_age=STATS_UNLOCK_MAX_AGE,
        httponly=True,
        samesite="lax",
    )


@router.get("/overview")
def overview(
    domain: str,
    request: Request,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    db: Database = Depends(get_db),
    user: UserDoc | None = Depends(get_current_user_optional),
):
    website = _get_website(db, domain)
    _guard(website, user, request)

    website_id = str(website["_id"])
    tz = _user_timezone(user)
    r = resolve_range(from_, to)

    visitors_map = time_series(db, website_id, r.from_date, r.to_date, r.unit, unique_only=True, timezone=tz)
    pageviews_map = time_series(db, website_id, r.from_date, r.to_date, r.unit, unique_only=False, timezone=tz)

    total_visitors_old = count_in_range(db, website_id, r.from_old, r.to_old, unique_only=True)
    total_pageviews_old = count_in_range(db, website_id, r.from_old, r.to_old, unique_only=False)

    def top5(key: str) -> list[dict[str, Any]]:
        _, _, rows = dimension_breakdown(db, DIMENSIONS[key], website_id, r.from_date, r.to_date, None, "count", "desc", 0, 5)
        return rows

    return {
        "range": {"from": r.from_date.isoformat(), "to": r.to_date.isoformat(), "unit": r.unit},
        "visitors_map": visitors_map,
        "pageviews_map": pageviews_map,
        "total_visitors": sum(visitors_map.values()),
        "total_pageviews": sum(pageviews_map.values()),
        "total_visitors_old": total_visitors_old,
        "total_pageviews_old": total_pageviews_old,
        "pages": top5("pages"),
        "referrers": top5("referrers"),
        "countries": top5("countries"),
        "browsers": top5("browsers"),
        "operating_systems": top5("operating-systems"),
        "devices": top5("devices"),
        "events": top5("events"),
    }


@router.get("/realtime")
def realtime(
    domain: str,
    request: Request,
    db: Database = Depends(get_db),
    user: UserDoc | None = Depends(get_current_user_optional),
):
    website = _get_website(db, domain)
    _guard(website, user, request)
    website_id = str(website["_id"])

    now = datetime.datetime.utcnow()
    window_start = now - datetime.timedelta(minutes=1)
    prev_window_start = window_start - datetime.timedelta(minutes=1)

    def bucket_counts(unique_only: bool, start: datetime.datetime, end: datetime.datetime) -> dict[str, int]:
        match: dict[str, Any] = {"website_id": website_id, "created_at": {"$gte": start, "$lte": end}}
        if unique_only:
            match["unique"] = True
        buckets: dict[str, int] = {}
        cur = start.replace(microsecond=0)
        while cur <= end:
            buckets[cur.strftime("%Y-%m-%d %H:%M:%S")] = 0
            cur += datetime.timedelta(seconds=1)
        for row in db.stats.aggregate(
            [
                {"$match": match},
                {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d %H:%M:%S", "date": "$created_at"}}, "count": {"$sum": 1}}},
            ]
        ):
            if row["_id"] in buckets:
                buckets[row["_id"]] = row["count"]
        return buckets

    visitors_map = bucket_counts(True, window_start, now)
    pageviews_map = bucket_counts(False, window_start, now)

    visitors_old = db.stats.count_documents(
        {"website_id": website_id, "unique": True, "created_at": {"$gte": prev_window_start, "$lt": window_start}}
    )
    pageviews_old = db.stats.count_documents(
        {"website_id": website_id, "created_at": {"$gte": prev_window_start, "$lt": window_start}}
    )

    recent = list(
        db.stats.find({"website_id": website_id, "created_at": {"$gte": window_start, "$lte": now}})
        .sort("created_at", -1)
        .limit(50)
    )
    for row in recent:
        row["id"] = str(row.pop("_id"))
        row["created_at"] = row["created_at"].isoformat()

    return {
        "visitors_map": visitors_map,
        "pageviews_map": pageviews_map,
        "total_visitors": sum(visitors_map.values()),
        "total_pageviews": sum(pageviews_map.values()),
        "visitors_old": visitors_old,
        "pageviews_old": pageviews_old,
        "recent": recent,
    }


def _parse_pagination(page: int, per_page: int) -> tuple[int, int]:
    # 250 isn't a UI page-size choice — it's used internally by the world map
    # to fetch every country's count in one request, independent of the
    # dimension table's own pagination.
    per_page = per_page if per_page in (10, 25, 50, 100, 250) else 25
    page = max(page, 1)
    return (page - 1) * per_page, per_page


@router.get("/{dimension}")
def breakdown(
    domain: str,
    dimension: str,
    request: Request,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    search: str | None = Query(default=None),
    sort_by: Literal["count", "value"] = Query(default="count"),
    sort: Literal["asc", "desc"] = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25),
    db: Database = Depends(get_db),
    user: UserDoc | None = Depends(get_current_user_optional),
):
    if dimension not in DIMENSIONS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown dimension")

    website = _get_website(db, domain)
    _guard(website, user, request)
    website_id = str(website["_id"])

    r = resolve_range(from_, to)
    skip, limit = _parse_pagination(page, per_page)

    total, total_count, rows = dimension_breakdown(db, DIMENSIONS[dimension], website_id, r.from_date, r.to_date, search, sort_by, sort, skip, limit)

    return {
        "range": {"from": r.from_date.isoformat(), "to": r.to_date.isoformat()},
        "total": total,
        "total_count": total_count,
        "page": page,
        "per_page": per_page,
        "results": rows,
    }


@router.get("/{dimension}/export")
def export_csv(
    domain: str,
    dimension: str,
    request: Request,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Database = Depends(get_db),
    user: UserDoc | None = Depends(get_current_user_optional),
):
    if dimension not in DIMENSIONS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown dimension")

    website = _get_website(db, domain)
    _guard(website, user, request)
    # data export is a plan-gated feature in the original (UserPolicy::dataExport);
    # this install is unlimited/private, so every owner/admin can export.
    website_id = str(website["_id"])

    r = resolve_range(from_, to)
    total_visitors = count_in_range(db, website_id, r.from_date, r.to_date, unique_only=True)
    total_pageviews = count_in_range(db, website_id, r.from_date, r.to_date, unique_only=False)
    _, _, rows = dimension_breakdown(db, DIMENSIONS[dimension], website_id, r.from_date, r.to_date, search, "count", "desc", 0, None)

    buffer = io.StringIO()
    buffer.write("﻿")  # UTF-8 BOM, matches the original's CSV output
    writer = csv.writer(buffer)
    writer.writerow(["Website", website["domain"]])
    writer.writerow(["Type", dimension])
    writer.writerow(["Interval", f"{r.from_date.isoformat()} - {r.to_date.isoformat()}"])
    writer.writerow(["Date", datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow([""])
    writer.writerow(["Visitors", total_visitors])
    writer.writerow(["Pageviews", total_pageviews])
    writer.writerow([""])
    writer.writerow(["Value", "Count"])
    for row in rows:
        writer.writerow([row["value"], row["count"]])

    filename = f"{website['domain']}-{dimension}-{r.from_date.isoformat()}-{r.to_date.isoformat()}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
