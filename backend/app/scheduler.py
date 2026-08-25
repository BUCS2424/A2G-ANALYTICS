"""Monthly report scheduling. Uses APScheduler's thread-based
BackgroundScheduler rather than AsyncIOScheduler since the job body (pymongo,
smtplib) is all synchronous — no event-loop integration needed."""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import get_settings
from app.database import db
from app.services.mail import send_email
from app.services.reports import build_report_context, previous_month_range, render_report_html

logger = logging.getLogger("app.scheduler")

_scheduler: BackgroundScheduler | None = None


def send_monthly_reports() -> dict[str, int]:
    """Sends the previous-calendar-month report to every website that has
    email reports enabled and at least one client email set — to *all* of
    that site's recipients. One failure (building a report, or one bad
    recipient address) doesn't stop the rest of the batch. Returns counts so
    callers (the cron job, or the manual admin trigger) can log/report a
    summary."""
    from_date, to_date = previous_month_range()
    websites = list(db.websites.find({"email": True, "client_emails": {"$exists": True, "$not": {"$size": 0}}}))
    logger.info("[REPORTS] Processing %d website(s) with reports enabled for %s - %s", len(websites), from_date, to_date)

    sites_failed = 0
    emails_sent = 0
    emails_failed = 0
    for website in websites:
        try:
            report_website = dict(website)
            if website.get("privacy") == 0:
                # No incoming request here to derive the origin from (unlike
                # the "send now" button, which runs inside a request) — the
                # deployment's own configured base URL stands in for it.
                report_website["_public_link"] = f"{get_settings().app_url}/{website['domain']}"

            context = build_report_context(db, report_website, from_date, to_date)
            html = render_report_html(context)
            subject = f"{website['domain']} — {context['month_label']} traffic report"

            for recipient in website["client_emails"]:
                try:
                    send_email(db, recipient, subject, html)
                    emails_sent += 1
                except Exception:
                    emails_failed += 1
                    logger.exception("[REPORTS] Failed to send %s's report to %s", website["domain"], recipient)
        except Exception:
            sites_failed += 1
            logger.exception("[REPORTS] Failed to build report for %s", website.get("domain"))

    logger.info("[REPORTS] Done: %d emails sent, %d emails failed, %d sites failed to build", emails_sent, emails_failed, sites_failed)
    return {"sites_total": len(websites), "sites_failed": sites_failed, "emails_sent": emails_sent, "emails_failed": emails_failed}


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        send_monthly_reports,
        trigger=CronTrigger(day=1, hour=6, minute=0),
        id="monthly_reports",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("[SCHEDULER] Monthly reports scheduled for the 1st of each month at 06:00 UTC")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
