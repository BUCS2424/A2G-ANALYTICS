"""Scratch script: seed realistic stats/events data for manual verification of
the stats dashboard aggregations. Not part of the app — delete before shipping."""

import datetime
import random

from app.database import db

website = db.websites.find_one({"domain": "example.com"})
if not website:
    raise SystemExit("Run the earlier smoke-test curl commands first to create example.com")

website_id = str(website["_id"])
db.stats.delete_many({"website_id": website_id})
db.events.delete_many({"website_id": website_id})

pages = ["/", "/pricing", "/blog/hello-world", "/docs", "/about"]
referrers = ["google.com", "twitter.com", None, None, "news.ycombinator.com", "www.google.com"]
browsers = ["Chrome", "Firefox", "Safari", "Edge"]
oses = ["Windows", "macOS", "Linux", "iOS"]
devices = ["desktop", "mobile", "tablet"]
countries = ["US:United States", "GB:United Kingdom", "DE:Germany", "IN:India"]
continents = ["NA:North America", "EU:Europe", "AS:Asia"]

now = datetime.datetime.utcnow()
rows = []
for days_ago in range(14):
    day = now - datetime.timedelta(days=days_ago)
    for _ in range(random.randint(5, 20)):
        ts = day - datetime.timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
        referrer = random.choice(referrers)
        rows.append(
            {
                "website_id": website_id,
                "unique": referrer is not None and "google" not in (referrer or "") or referrer is None,
                "referrer": referrer,
                "page": random.choice(pages),
                "browser": random.choice(browsers),
                "operating_system": random.choice(oses),
                "device": random.choice(devices),
                "continent": random.choice(continents),
                "country": random.choice(countries),
                "city": None,
                "screen_resolution": "1920x1080",
                "theme": random.choice(["dark", "light"]),
                "campaign": random.choice([None, None, None, "launch", "spring-sale"]),
                "language": random.choice(["en", "de", "fr"]),
                "created_at": ts,
            }
        )

db.stats.insert_many(rows)
db.events.insert_many(
    [
        {"website_id": website_id, "value": "signup:1:count", "created_at": now - datetime.timedelta(hours=i)}
        for i in range(5)
    ]
)

print(f"Inserted {len(rows)} stats rows and 5 events for website {website_id}")
