"""The public tracking beacon. Hit by the embedded script (see
static/js/script.js) on every pageview / custom event from every tracked site.
No auth — the website is identified purely by the domain in the `page` URL.

This is the one endpoint that must stay byte-compatible with the original
contract: every site already embeds
    <script data-host="https://a2ganalytics.com" ... src="https://a2ganalytics.com/js/script.js" id="ZwSg9rf6GA" ...>
so the path (/api/event), request shape, and response codes here cannot change
without breaking every already-deployed tag.
"""

import datetime

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from pymongo.database import Database

from app.database import get_db
from app.mongo_utils import to_object_id
from app.schemas.event import DurationBeaconRequest, EventBeaconRequest
from app.services.tracking import (
    apply_excluded_params,
    device_type,
    geolocate,
    get_query_params,
    ip_matches_any,
    parse_client_ua,
    parse_tracked_url,
    split_exclusion_list,
    truncate,
)

router = APIRouter(tags=["tracking"])


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


def _parse_custom_event(raw: str) -> str | None:
    """name:value:unit -> validated, colon-joined value string, or None if the
    name is missing/too long (mirrors the original's silent-drop behavior)."""
    parts = raw.split(":")
    name = parts[0].strip() if parts else ""
    if not name or len(name) > 64:
        return None

    pieces = [name]

    if len(parts) > 1:
        value = parts[1].strip()
        if value and len(value) <= 24:
            try:
                float(value)
                pieces.append(value)
            except ValueError:
                pass

    if len(parts) > 2:
        unit = parts[2].strip()
        if unit and len(unit) <= 32:
            pieces.append(unit)

    return ":".join(pieces)


@router.post("/api/event")
def track_event(payload: EventBeaconRequest, request: Request, db: Database = Depends(get_db)):
    page_url = parse_tracked_url(payload.page)
    domain = page_url.non_www_host if page_url else None

    website = db.websites.find_one({"domain": domain}) if domain else None
    if website is None:
        return Response(status_code=status.HTTP_404_NOT_FOUND)

    owner = db.users.find_one({"_id": to_object_id(website["user_id"])})
    if owner is None or not owner.get("can_track_websites"):
        return Response(status_code=status.HTTP_403_FORBIDDEN)

    client_ip = _client_ip(request)
    excluded_ips = split_exclusion_list(website.get("exclude_ips"))
    if excluded_ips and ip_matches_any(client_ip, excluded_ips):
        return Response(status_code=status.HTTP_403_FORBIDDEN)

    ua = parse_client_ua(request.headers.get("user-agent", ""))
    if website.get("exclude_bots") and device_type(ua) == "bot":
        return Response(status_code=status.HTTP_403_FORBIDDEN)

    now = datetime.datetime.utcnow()
    website_id = str(website["_id"])

    if payload.event:
        value = _parse_custom_event(payload.event)
        if value is None:
            return Response(status_code=status.HTTP_204_NO_CONTENT)
        db.events.insert_one({"website_id": website_id, "value": value, "created_at": now})
        return Response(status_code=status.HTTP_200_OK)

    referrer_url = parse_tracked_url(payload.referrer)

    excluded_params = split_exclusion_list(website.get("exclude_params"))
    original_params = get_query_params(page_url.query if page_url else None)
    wildcard_exclude_all = "&" in excluded_params

    # Quirk preserved from the original: a wildcard "&" rule blanks the *stored*
    # page path's query string, but UTM campaign detection still reads from the
    # unfiltered params — only a named-param exclusion actually removes
    # utm_campaign from campaign tracking too.
    if wildcard_exclude_all:
        filtered_query = None
        campaign_params = original_params
    else:
        filtered_query = apply_excluded_params(page_url.query if page_url else None, excluded_params)
        campaign_params = get_query_params(filtered_query)

    path = (page_url.path if page_url else None) or "/"
    page_value = f"{path}?{filtered_query}" if filtered_query else path
    page_value = truncate(page_value, 255)

    continent, country, city = geolocate(client_ip)

    browser = truncate(ua.browser.family, 64)
    operating_system = truncate(ua.os.family, 64)
    device = truncate(device_type(ua), 64)

    accept_language = request.headers.get("accept-language")
    language = truncate(accept_language, 2) if accept_language else None

    campaign = None
    utm_values = campaign_params.get("utm_campaign")
    if utm_values and utm_values[0]:
        campaign = truncate(utm_values[0], 64)

    is_unique = not referrer_url or referrer_url.non_www_host != website["domain"]

    result = db.stats.insert_one(
        {
            "website_id": website_id,
            "unique": is_unique,
            "referrer": truncate(referrer_url.host, 255) if referrer_url else None,
            "page": page_value,
            "browser": browser,
            "operating_system": operating_system,
            "device": device,
            "continent": truncate(continent, 16),
            "country": truncate(country, 64),
            "city": truncate(city, 128),
            "screen_resolution": truncate(payload.screen_resolution, 16),
            "theme": truncate(payload.theme, 8),
            "campaign": campaign,
            "language": language,
            "visitor_id": truncate(payload.visitor_id, 64),
            "duration_seconds": None,
            "created_at": now,
        }
    )
    db.users.update_one({"_id": owner["_id"]}, {"$inc": {"website_pageviews_count": 1}})

    # Response body is a purely additive change (id used for the time-on-page
    # beacon below) — the original script never read it, so this can't break
    # any already-embedded tag.
    return JSONResponse(status_code=status.HTTP_200_OK, content={"id": str(result.inserted_id)})


@router.post("/api/event/duration")
def track_duration(payload: DurationBeaconRequest, db: Database = Depends(get_db)):
    """Time-on-page beacon, sent via navigator.sendBeacon when the visitor
    leaves a page. Best-effort: no auth, no error if the id is stale/unknown."""
    stat_id = to_object_id(payload.id)
    if stat_id is None or not (0 < payload.duration <= 24 * 60 * 60):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    db.stats.update_one({"_id": stat_id, "duration_seconds": None}, {"$set": {"duration_seconds": payload.duration}})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
