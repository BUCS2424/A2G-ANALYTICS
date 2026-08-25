"""Outbound email, driven by the admin Settings > Email tab. Mirrors the
original's mail_driver concept: 'log' (default, no real send — safe until
SMTP is configured) vs 'smtp' (real delivery via the configured server)."""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from pymongo.database import Database

from app.services.settings import get_all_settings


def send_email(db: Database, to_address: str, subject: str, html_body: str) -> None:
    settings = get_all_settings(db)
    driver = settings.get("mail_driver") or "log"

    if driver != "smtp":
        print(f"[MAIL:LOG] To: {to_address} | Subject: {subject} | ({len(html_body)} chars of HTML body, not sent — mail_driver is 'log')")
        return

    host = settings.get("mail_host")
    username = settings.get("mail_username")
    password = settings.get("mail_password")
    from_address = settings.get("mail_from_address") or username
    encryption = (settings.get("mail_encryption") or "tls").lower()
    try:
        port = int(settings.get("mail_port") or 587)
    except ValueError:
        port = 587

    if not host or not from_address:
        print(f"[MAIL:ERROR] mail_driver is 'smtp' but mail_host/mail_from_address isn't configured — dropping email to {to_address}")
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = from_address
    message["To"] = to_address
    message.attach(MIMEText(html_body, "html"))

    server = smtplib.SMTP_SSL(host, port) if encryption == "ssl" else smtplib.SMTP(host, port)
    try:
        if encryption == "tls":
            server.starttls()
        if username and password:
            server.login(username, password)
        server.sendmail(from_address, [to_address], message.as_string())
    finally:
        server.quit()
