import datetime

from pydantic import BaseModel, EmailStr, Field


class WebsiteCreate(BaseModel):
    domain: str = Field(min_length=1, max_length=255)
    privacy: int = 0
    password: str | None = None
    exclude_bots: bool | None = None
    exclude_params: str | None = None
    exclude_ips: str | None = None
    email: bool | None = None
    client_emails: list[EmailStr] = Field(default_factory=list)


class WebsiteUpdate(BaseModel):
    domain: str | None = Field(default=None, min_length=1, max_length=255)
    privacy: int | None = None
    password: str | None = None
    exclude_bots: bool | None = None
    exclude_params: str | None = None
    exclude_ips: str | None = None
    email: bool | None = None
    client_emails: list[EmailStr] | None = None
    favorited: bool | None = None


class WebsiteOut(BaseModel):
    id: str
    domain: str
    user_id: str
    privacy: int
    email: bool | None = None
    client_emails: list[str] = Field(default_factory=list)
    exclude_bots: bool | None = None
    exclude_params: str | None = None
    exclude_ips: str | None = None
    favorited_at: datetime.datetime | None = None
    created_at: datetime.datetime | None = None
