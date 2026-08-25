from pydantic import BaseModel


class EventBeaconRequest(BaseModel):
    page: str | None = None
    referrer: str | None = None
    screen_resolution: str | None = None
    theme: str | None = None
    event: str | None = None
    visitor_id: str | None = None


class DurationBeaconRequest(BaseModel):
    id: str
    duration: int
