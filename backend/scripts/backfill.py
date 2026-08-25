"""One-off migration: real MySQL production dump -> MongoDB.

Reads from a temporary MySQL container (see scripts/README-backfill.md) that
the original a2gan2025_MAY-2025.sql.gz dump was imported into, transforms
each row into the new schema, and loads it into the app's MongoDB. Only
needs pymysql for this one script — the app itself never talks to MySQL.

Known, deliberate lossy spots:
  - Website `password` (privacy=2 sites) was encrypted with the original
    app's Laravel APP_KEY, which we don't have — can't decrypt, so it's set
    to null. Those sites need a new password set via the UI after migration.
  - Payment/license/bank/billing settings are dropped (private install has
    no billing system — see the rewrite plan's Context section).
"""

import sys
from pathlib import Path

import pymysql
import pymysql.cursors

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import db, ensure_indexes  # noqa: E402

MYSQL_CONFIG = dict(
    host="127.0.0.1",
    port=3306,
    user="root",
    password="temppass123",
    database="a2g_import",
    charset="utf8mb4",
    cursorclass=pymysql.cursors.DictCursor,
)

SETTINGS_EXCLUDE_PREFIXES = (
    "paddle", "paypal", "paystack", "razorpay", "stripe", "coinbase",
    "cryptocom", "bank", "billing_", "license_",
)


def migrate_users() -> dict[int, object]:
    conn = pymysql.connect(**MYSQL_CONFIG)
    id_map: dict[int, object] = {}
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users")
            for row in cur.fetchall():
                doc = {
                    "name": row["name"],
                    "email": row["email"].lower(),
                    # Laravel's $2y$ bcrypt variant is byte-identical to $2b$;
                    # normalizing avoids relying on the local bcrypt build's
                    # $2y$ support so existing passwords keep working.
                    "password": row["password"].replace("$2y$", "$2b$", 1),
                    "avatar": row["avatar"],
                    "api_token": row["api_token"],
                    "locale": row["locale"],
                    "timezone": row["timezone"],
                    "role": row["role"],
                    "tfa": row["tfa"],
                    "tfa_code": row["tfa_code"],
                    "tfa_code_created_at": row["tfa_code_created_at"],
                    "authed_at": row["authed_at"],
                    "has_websites": bool(row["has_websites"]),
                    "can_track_websites": True,  # unlimited private install
                    "website_pageviews_count": row["website_pageviews_count"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "deleted_at": row["deleted_at"],
                }
                result = db.users.insert_one(doc)
                id_map[row["id"]] = result.inserted_id
    finally:
        conn.close()
    return id_map


def migrate_websites(user_id_map: dict[int, object]) -> tuple[dict[int, object], list[str]]:
    conn = pymysql.connect(**MYSQL_CONFIG)
    id_map: dict[int, object] = {}
    password_sites: list[str] = []
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM websites")
            for row in cur.fetchall():
                new_user_id = user_id_map.get(row["user_id"])
                if new_user_id is None:
                    continue
                if row["privacy"] == 2 and row["password"]:
                    password_sites.append(row["domain"])
                doc = {
                    "domain": row["domain"],
                    "user_id": str(new_user_id),
                    "privacy": row["privacy"] or 0,
                    "password": None,
                    "exclude_bots": bool(row["exclude_bots"]) if row["exclude_bots"] is not None else None,
                    "exclude_params": row["exclude_params"],
                    "exclude_ips": row["exclude_ips"],
                    "email": bool(row["email"]) if row["email"] is not None else None,
                    "favorited_at": row["favorited_at"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                }
                result = db.websites.insert_one(doc)
                id_map[row["id"]] = result.inserted_id
    finally:
        conn.close()
    return id_map, password_sites


def migrate_stats(website_id_map: dict[int, object]) -> tuple[int, int]:
    config = {**MYSQL_CONFIG, "cursorclass": pymysql.cursors.SSDictCursor}
    conn = pymysql.connect(**config)
    total = 0
    skipped = 0
    batch: list[dict] = []
    BATCH_SIZE = 5000
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM stats")
            for row in cur:
                new_website_id = website_id_map.get(row["website_id"])
                if new_website_id is None:
                    skipped += 1
                    continue
                batch.append(
                    {
                        "website_id": str(new_website_id),
                        "unique": bool(row["unique"]) if row["unique"] is not None else None,
                        "referrer": row["referrer"],
                        "page": row["page"],
                        "browser": row["browser"],
                        "operating_system": row["operating_system"],
                        "device": row["device"],
                        "continent": row["continent"],
                        "country": row["country"],
                        "city": row["city"],
                        "screen_resolution": row["screen_resolution"],
                        "theme": row["theme"],
                        "campaign": row["campaign"],
                        "language": row["language"],
                        "visitor_id": None,
                        "duration_seconds": None,
                        "created_at": row["created_at"],
                    }
                )
                if len(batch) >= BATCH_SIZE:
                    db.stats.insert_many(batch)
                    total += len(batch)
                    print(f"  ...{total:,} stats rows imported")
                    batch = []
        if batch:
            db.stats.insert_many(batch)
            total += len(batch)
    finally:
        conn.close()
    return total, skipped


def migrate_settings() -> tuple[int, int]:
    conn = pymysql.connect(**MYSQL_CONFIG)
    imported = skipped = 0
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM settings")
            for row in cur.fetchall():
                name = row["name"]
                if any(name == p or name.startswith(p) for p in SETTINGS_EXCLUDE_PREFIXES):
                    skipped += 1
                    continue
                db.settings.update_one({"_id": name}, {"$set": {"value": row["value"]}}, upsert=True)
                imported += 1
    finally:
        conn.close()
    return imported, skipped


def main() -> None:
    print("Clearing existing users/websites/stats/events/settings collections...")
    for coll in ("users", "websites", "stats", "events", "settings"):
        db[coll].delete_many({})

    print("Migrating users...")
    user_id_map = migrate_users()
    print(f"  {len(user_id_map)} users migrated")

    print("Migrating websites...")
    website_id_map, password_sites = migrate_websites(user_id_map)
    print(f"  {len(website_id_map)} websites migrated")
    if password_sites:
        print(f"  NOTE: {len(password_sites)} password-protected site(s) need a NEW password set")
        print(f"        (old encryption can't be read without the original APP_KEY): {password_sites}")

    print("Migrating stats (this takes a bit for ~1M rows)...")
    stats_count, stats_skipped = migrate_stats(website_id_map)
    print(f"  {stats_count:,} stats rows migrated, {stats_skipped} skipped (orphaned website_id)")

    print("Migrating settings...")
    settings_count, settings_skipped = migrate_settings()
    print(f"  {settings_count} settings imported, {settings_skipped} skipped (payment/license/billing)")

    print("Rebuilding indexes...")
    ensure_indexes()

    print("\nDone. Final counts:")
    for coll in ("users", "websites", "stats", "events", "settings"):
        print(f"  {coll}: {db[coll].count_documents({}):,}")


if __name__ == "__main__":
    main()
