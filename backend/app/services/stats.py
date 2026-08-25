"""Stats aggregation engine. Ported from app/Http/Controllers/StatController.php
+ app/Traits/DateRangeTrait.php, but generalized: the original repeats the same
query shape ~15 times (one method per dimension); here it's one parameterized
aggregation driven by DIMENSIONS below, since Mongo's aggregation pipeline can
express "group by field X, with these filters" generically."""

from __future__ import annotations

import datetime
from dataclasses import dataclass
from typing import Any, Literal

from pymongo.database import Database

# --- Date range (mirrors DateRangeTrait::range) -----------------------------


@dataclass
class DateRange:
    from_date: datetime.date
    to_date: datetime.date
    from_old: datetime.date
    to_old: datetime.date
    unit: Literal["hour", "day", "month", "year"]


def resolve_range(from_str: str | None, to_str: str | None) -> DateRange:
    today = datetime.date.today()

    def parse(value: str | None) -> datetime.date | None:
        if not value:
            return None
        try:
            return datetime.datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            return None

    to_date = parse(to_str) or today
    from_date = parse(from_str) or to_date
    if from_date > to_date:
        from_date = to_date

    span_days = (to_date - from_date).days

    if span_days < 1:
        unit: Literal["hour", "day", "month", "year"] = "hour"
    elif span_days < 90:
        unit = "day"
    elif span_days < 730:
        unit = "month"
    else:
        unit = "year"

    if span_days >= 36500:
        to_date = today
        from_date = today

    to_old = from_date - datetime.timedelta(days=1)
    from_old = to_old - datetime.timedelta(days=(to_date - from_date).days)

    return DateRange(from_date=from_date, to_date=to_date, from_old=from_old, to_old=to_old, unit=unit)


_MONGO_DATE_FORMAT = {
    "hour": "%Y-%m-%d %H",
    "day": "%Y-%m-%d",
    "month": "%Y-%m",
    "year": "%Y",
}

_PY_DATE_FORMAT = {
    "hour": "%Y-%m-%d %H",
    "day": "%Y-%m-%d",
    "month": "%Y-%m",
    "year": "%Y",
}


def all_buckets(from_date: datetime.date, to_date: datetime.date, unit: str) -> list[str]:
    """Zero-filled bucket labels for every point in [from_date, to_date] —
    mirrors DateRangeTrait::calcAllDates, so charts never show gaps."""
    start = datetime.datetime.combine(from_date, datetime.time.min)
    end = datetime.datetime.combine(to_date, datetime.time.max)
    fmt = _PY_DATE_FORMAT[unit]

    labels = [start.strftime(fmt)]
    current = start
    while current < end:
        if unit == "year":
            current = current.replace(year=current.year + 1, month=1, day=1)
        elif unit == "month":
            year, month = current.year, current.month + 1
            if month > 12:
                year, month = year + 1, 1
            current = current.replace(year=year, month=month, day=1)
        elif unit == "day":
            current = current + datetime.timedelta(days=1)
        else:  # hour
            current = current + datetime.timedelta(hours=1)
        if current <= end:
            labels.append(current.strftime(fmt))
    return labels


def datetime_bounds(from_date: datetime.date, to_date: datetime.date) -> tuple[datetime.datetime, datetime.datetime]:
    return (
        datetime.datetime.combine(from_date, datetime.time.min),
        datetime.datetime.combine(to_date, datetime.time.max),
    )


def time_series(
    db: Database,
    website_id: str,
    from_date: datetime.date,
    to_date: datetime.date,
    unit: str,
    unique_only: bool,
    timezone: str = "UTC",
) -> dict[str, int]:
    start, end = datetime_bounds(from_date, to_date)
    match: dict[str, Any] = {"website_id": website_id, "created_at": {"$gte": start, "$lte": end}}
    if unique_only:
        match["unique"] = True

    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": {"$dateToString": {"format": _MONGO_DATE_FORMAT[unit], "date": "$created_at", "timezone": timezone}},
                "count": {"$sum": 1},
            }
        },
    ]
    buckets = {label: 0 for label in all_buckets(from_date, to_date, unit)}
    for row in db.stats.aggregate(pipeline):
        if row["_id"] in buckets:
            buckets[row["_id"]] = row["count"]
    return buckets


def count_in_range(db: Database, website_id: str, from_date: datetime.date, to_date: datetime.date, unique_only: bool) -> int:
    start, end = datetime_bounds(from_date, to_date)
    match: dict[str, Any] = {"website_id": website_id, "created_at": {"$gte": start, "$lte": end}}
    if unique_only:
        match["unique"] = True
    return db.stats.count_documents(match)


# --- Dimension breakdowns (mirrors the ~15 get*() helper methods) ----------

SOCIAL_NETWORKS = [
    "l.facebook.com", "t.co", "l.instagram.com", "out.reddit.com", "www.youtube.com",
    "away.vk.com", "t.umblr.com", "www.pinterest.com", "www.snapchat.com",
]

SEARCH_ENGINES = [
    "www.google.com", "www.bing.com", "search.yahoo.com", "uk.search.yahoo.com",
    "de.search.yahoo.com", "fr.search.yahoo.com", "es.search.yahoo.com",
    "search.aol.co.uk", "search.aol.com", "duckduckgo.com", "www.baidu.com",
    "yandex.ru", "www.ecosia.org", "search.lycos.com", "www.qwant.com",
    "search.brave.com", "search.naver.com", "www.sogou.com",
]


@dataclass
class Dimension:
    collection: str
    field: str
    unique_only: bool
    not_null: bool
    allow_list: list[str] | None = None


DIMENSIONS: dict[str, Dimension] = {
    "pages": Dimension("stats", "page", unique_only=False, not_null=False),
    "landing-pages": Dimension("stats", "page", unique_only=True, not_null=False),
    "referrers": Dimension("stats", "referrer", unique_only=True, not_null=False),
    "search-engines": Dimension("stats", "referrer", unique_only=True, not_null=True, allow_list=SEARCH_ENGINES),
    "social-networks": Dimension("stats", "referrer", unique_only=True, not_null=True, allow_list=SOCIAL_NETWORKS),
    "campaigns": Dimension("stats", "campaign", unique_only=True, not_null=True),
    "continents": Dimension("stats", "continent", unique_only=True, not_null=False),
    "countries": Dimension("stats", "country", unique_only=True, not_null=False),
    "cities": Dimension("stats", "city", unique_only=True, not_null=False),
    "languages": Dimension("stats", "language", unique_only=True, not_null=False),
    "browsers": Dimension("stats", "browser", unique_only=True, not_null=False),
    "operating-systems": Dimension("stats", "operating_system", unique_only=True, not_null=False),
    "screen-resolutions": Dimension("stats", "screen_resolution", unique_only=True, not_null=False),
    "devices": Dimension("stats", "device", unique_only=True, not_null=False),
    "events": Dimension("events", "value", unique_only=False, not_null=False),
}


def dimension_breakdown(
    db: Database,
    dimension: Dimension,
    website_id: str,
    from_date: datetime.date,
    to_date: datetime.date,
    search: str | None,
    sort_by: Literal["count", "value"],
    sort_dir: Literal["asc", "desc"],
    skip: int,
    limit: int | None,
) -> tuple[int, int, list[dict[str, Any]]]:
    start, end = datetime_bounds(from_date, to_date)
    match: dict[str, Any] = {"website_id": website_id, "created_at": {"$gte": start, "$lte": end}}
    if dimension.unique_only:
        match["unique"] = True
    if dimension.not_null:
        match[dimension.field] = {"$ne": None}
    if dimension.allow_list:
        match[dimension.field] = {"$in": dimension.allow_list}
    if search:
        # merges with any $in/$ne already set on the field via $and, so allow-list
        # filtering and search can both apply (matches search-engines/social-networks)
        field_filter = match.pop(dimension.field, None)
        conditions = [{dimension.field: {"$regex": search, "$options": "i"}}]
        if field_filter is not None:
            conditions.append({dimension.field: field_filter})
        match["$and"] = conditions

    sort_field = "count" if sort_by == "count" else "_id"
    sort_direction = -1 if sort_dir == "desc" else 1

    facet_pipeline: list[dict[str, Any]] = [{"$sort": {sort_field: sort_direction}}]
    if skip:
        facet_pipeline.append({"$skip": skip})
    if limit is not None:
        facet_pipeline.append({"$limit": limit})

    pipeline = [
        {"$match": match},
        {"$group": {"_id": f"${dimension.field}", "count": {"$sum": 1}}},
        {
            "$facet": {
                "results": facet_pipeline,
                "total": [{"$count": "count"}],
                "sum": [{"$group": {"_id": None, "count": {"$sum": "$count"}}}],
            }
        },
    ]

    result = next(db[dimension.collection].aggregate(pipeline), {"results": [], "total": [], "sum": []})
    total_rows = result["total"][0]["count"] if result["total"] else 0
    total_count = result["sum"][0]["count"] if result["sum"] else 0
    rows = [{"value": row["_id"], "count": row["count"]} for row in result["results"]]
    return total_rows, total_count, rows
