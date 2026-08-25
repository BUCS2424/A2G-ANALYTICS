import sys
from functools import lru_cache

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

# Required in any real deployment — no safe default exists for either (a weak
# fallback secret is a security hole, a fallback DB URI would silently point
# at nothing). Local dev supplies both via .env; a container must get them
# via `docker run -e`. See _fail_loud_if_missing below for the boot check
# the deploy panel's CONTAINER_CONTRACT.md requires.
_REQUIRED_VARS = ("SECRET_KEY", "MONGODB_URI")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "A2G Analytics"
    app_url: str = "http://a2ganalytics.localhost:5173"
    secret_key: str
    debug: bool = False

    mongodb_uri: str
    mongodb_db: str = "a2g_analytics"

    port: int = 8000

    session_cookie_name: str = "a2g_session"
    session_max_age_seconds: int = 60 * 60 * 24 * 120  # 120 days, matches original SESSION_LIFETIME-ish default

    geoip_db_path: str = "geoip/GeoLite2-City.mmdb"

    cors_origins: list[str] = ["http://a2ganalytics.localhost:5173", "http://localhost:5173"]


def _fail_loud_if_missing() -> None:
    """Matches the deploy panel's required boot-check format exactly, so a
    misconfigured container is diagnosable from the panel's log viewer
    instead of showing a raw pydantic traceback."""
    try:
        Settings()
    except ValidationError as exc:
        missing = [str(err["loc"][0]).upper() for err in exc.errors() if err["type"] == "missing"]
        if missing:
            print(f"[BOOT] FATAL: missing required environment variables: {', '.join(missing)}", file=sys.stderr)
            sys.exit(1)
        raise


@lru_cache
def get_settings() -> Settings:
    _fail_loud_if_missing()
    return Settings()
