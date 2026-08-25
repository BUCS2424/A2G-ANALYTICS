import datetime

from pydantic import BaseModel, EmailStr


class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: int = 0


class AdminUserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    role: int | None = None


class AdminUserOut(BaseModel):
    id: str
    name: str
    email: str
    role: int
    has_websites: bool
    website_pageviews_count: int
    created_at: datetime.datetime | None = None
    authed_at: datetime.datetime | None = None


class AdminWebsiteOut(BaseModel):
    id: str
    domain: str
    user_id: str
    owner_email: str | None = None
    privacy: int
    created_at: datetime.datetime | None = None


class PageCreate(BaseModel):
    name: str
    slug: str
    visibility: int = 1
    language: str | None = None
    content: str = ""


class PageUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    visibility: int | None = None
    language: str | None = None
    content: str | None = None


class PageOut(BaseModel):
    id: str
    name: str
    slug: str
    visibility: int
    language: str | None = None
    content: str
    created_at: datetime.datetime | None = None
    updated_at: datetime.datetime | None = None
