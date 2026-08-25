"""Helpers for the /api/event tracking beacon. Ported 1:1 from
original-app/app/Http/Controllers/API/EventController.php so pageview/event
semantics (unique-visitor flag, dimension truncation lengths, geoip format
strings) match exactly, since existing dashboards and any downstream tooling
assume that exact shape."""

from __future__ import annotations

import ipaddress
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import parse_qs, urlencode, urlsplit

import geoip2.database
import geoip2.errors
from user_agents import parse as parse_user_agent
from user_agents.parsers import UserAgent

from app.config import get_settings

settings = get_settings()


@dataclass
class ParsedUrl:
    host: str | None = None
    non_www_host: str | None = None
    path: str | None = None
    query: str | None = None


def parse_tracked_url(url: str | None) -> ParsedUrl | None:
    """Mirrors EventController::parseUrl — returns None if the URL has no host
    (e.g. empty string, as document.referrer often is on direct visits)."""
    if not url:
        return None
    parts = urlsplit(url)
    if not parts.hostname:
        return None
    host = parts.hostname.lower()
    non_www_host = host.removeprefix("www.")
    return ParsedUrl(host=host, non_www_host=non_www_host, path=parts.path or "/", query=parts.query or None)


def ip_matches_any(ip: str, patterns: list[str]) -> bool:
    """Mirrors Symfony IpUtils::checkIp — patterns may be plain IPs or CIDR ranges."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False

    for pattern in patterns:
        pattern = pattern.strip()
        if not pattern:
            continue
        try:
            if "/" in pattern:
                if addr in ipaddress.ip_network(pattern, strict=False):
                    return True
            elif addr == ipaddress.ip_address(pattern):
                return True
        except ValueError:
            continue
    return False


def split_exclusion_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [line.strip() for line in raw.splitlines() if line.strip()]


def apply_excluded_params(query: str | None, excluded: list[str]) -> str | None:
    """Mirrors the exclude_params logic: '&' as a lone entry strips the whole
    query string; otherwise each named param is dropped."""
    if not query:
        return None
    if not excluded:
        return query
    if "&" in excluded:
        return None

    params = parse_qs(query, keep_blank_values=True)
    for name in excluded:
        params.pop(name, None)
    if not params:
        return None
    return urlencode(params, doseq=True)


def get_query_params(query: str | None) -> dict[str, list[str]]:
    if not query:
        return {}
    return parse_qs(query, keep_blank_values=True)


@lru_cache
def get_geoip_reader() -> geoip2.database.Reader | None:
    try:
        return geoip2.database.Reader(settings.geoip_db_path)
    except FileNotFoundError:
        return None


def geolocate(ip: str) -> tuple[str | None, str | None, str | None]:
    """Returns (continent, country, city) as 'code:name' strings, matching the
    original's exact format — including reusing the *country* isoCode as the
    city string's prefix, which is what the original does (not a typo here)."""
    reader = get_geoip_reader()
    if reader is None:
        return None, None, None
    try:
        result = reader.city(ip)
    except (geoip2.errors.AddressNotFoundError, ValueError):
        return None, None, None

    continent = f"{result.continent.code}:{result.continent.name}" if result.continent.code else None
    country = f"{result.country.iso_code}:{result.country.name}" if result.country.iso_code else None

    city = None
    if result.country.iso_code and result.city.name:
        city = f"{result.country.iso_code}:{result.city.name}"
        if result.subdivisions.most_specific.iso_code:
            city += f", {result.subdivisions.most_specific.iso_code}"

    return continent, country, city


def parse_client_ua(ua_string: str) -> UserAgent:
    return parse_user_agent(ua_string)


def device_type(ua: UserAgent) -> str:
    if ua.is_bot:
        return "bot"
    if ua.is_tablet:
        return "tablet"
    if ua.is_mobile:
        return "mobile"
    if ua.is_pc:
        return "desktop"
    return "other"


def truncate(value: str | None, length: int) -> str | None:
    if value is None:
        return None
    return value[:length]
