"""Monthly email report: aggregates a website's previous-calendar-month stats
and renders them into the HTML template in app/templates/monthly_report.html."""

import calendar
import datetime
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader
from pymongo.database import Database

from app.services.stats import DIMENSIONS, count_in_range, dimension_breakdown

_env = Environment(loader=FileSystemLoader(str(Path(__file__).resolve().parents[1] / "templates")))


def _flag_emoji(value: str) -> str | None:
    """Country values are stored as 'US:United States' — same convention the
    frontend's utils/flags.ts uses, reimplemented here since this render
    happens server-side for the emailed report."""
    iso_code = value.split(":", 1)[0]
    if len(iso_code) != 2 or not iso_code.isalpha():
        return None
    return "".join(chr(127397 + ord(c)) for c in iso_code.upper())


def previous_month_range(reference: datetime.date | None = None) -> tuple[datetime.date, datetime.date]:
    """The full previous calendar month relative to `reference` (defaults to
    today) — e.g. run on 2026-09-01, this returns all of August 2026."""
    today = reference or datetime.date.today()
    first_of_this_month = today.replace(day=1)
    last_of_prev_month = first_of_this_month - datetime.timedelta(days=1)
    first_of_prev_month = last_of_prev_month.replace(day=1)
    return first_of_prev_month, last_of_prev_month


def _fmt(n: int) -> str:
    return f"{n:,}"


def _change(current: int, previous: int) -> tuple[str, str]:
    if previous == 0:
        pct = "+100%" if current > 0 else "0%"
    else:
        p = ((current - previous) / previous) * 100
        pct = f"{'+' if p >= 0 else ''}{p:.1f}%"
    color = "#16a34a" if current >= previous else "#dc2626"
    return pct, color


def build_report_context(db: Database, website: dict[str, Any], from_date: datetime.date, to_date: datetime.date) -> dict[str, Any]:
    website_id = str(website["_id"])
    span_days = (to_date - from_date).days + 1
    prev_to = from_date - datetime.timedelta(days=1)
    prev_from = prev_to - datetime.timedelta(days=span_days - 1)

    total_visitors = count_in_range(db, website_id, from_date, to_date, unique_only=True)
    total_pageviews = count_in_range(db, website_id, from_date, to_date, unique_only=False)
    prev_visitors = count_in_range(db, website_id, prev_from, prev_to, unique_only=True)
    prev_pageviews = count_in_range(db, website_id, prev_from, prev_to, unique_only=False)

    def top(key: str, limit: int = 5) -> list[dict[str, Any]]:
        _, _, rows = dimension_breakdown(db, DIMENSIONS[key], website_id, from_date, to_date, None, "count", "desc", 0, limit)
        return [{"value": r["value"], "count_fmt": _fmt(r["count"])} for r in rows]

    countries_raw = top("countries")
    countries = []
    for row in countries_raw:
        value = row["value"] or ""
        name = value.split(":", 1)[1] if ":" in value else "Direct / None"
        countries.append({"name": name, "count_fmt": row["count_fmt"], "flag": _flag_emoji(value) or ""})

    _, device_total, device_rows = dimension_breakdown(db, DIMENSIONS["devices"], website_id, from_date, to_date, None, "count", "desc", 0, None)
    devices = [
        {"value": r["value"], "pct": round((r["count"] / device_total) * 100) if device_total else 0}
        for r in device_rows
    ]

    visitors_change, visitors_color = _change(total_visitors, prev_visitors)
    pageviews_change, pageviews_color = _change(total_pageviews, prev_pageviews)

    public_link = None
    if website.get("privacy") == 0:
        # Populated by the caller with the app's own base URL — kept out of
        # this module since it has no business knowing request/env details.
        public_link = website.get("_public_link")

    return {
        "domain": website["domain"],
        "month_label": from_date.strftime("%B %Y"),
        "range_label": f"{from_date.strftime('%b %d')} – {to_date.strftime('%b %d, %Y')}",
        "total_visitors_fmt": _fmt(total_visitors),
        "total_pageviews_fmt": _fmt(total_pageviews),
        "visitors_change": visitors_change,
        "visitors_change_color": visitors_color,
        "pageviews_change": pageviews_change,
        "pageviews_change_color": pageviews_color,
        "top_pages": top("pages"),
        "top_referrers": top("referrers"),
        "top_countries": countries,
        "devices": devices,
        "public_link": public_link,
    }


def render_report_html(context: dict[str, Any]) -> str:
    template = _env.get_template("monthly_report.html")
    return template.render(**context)
