import base64
import hashlib
import secrets

import bcrypt
from cryptography.fernet import Fernet
from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.config import get_settings

settings = get_settings()

_session_serializer = URLSafeTimedSerializer(settings.secret_key, salt="a2g-session")
_stats_unlock_serializer = URLSafeTimedSerializer(settings.secret_key, salt="a2g-stats-unlock")

# Fernet needs a 32-byte url-safe base64 key; derive one deterministically from SECRET_KEY
# so a website's `password` column stays decryptable across restarts without a second secret.
_fernet_key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
_fernet = Fernet(_fernet_key)


def hash_password(raw_password: str) -> str:
    # bcrypt's algorithm only uses the first 72 bytes of the input.
    return bcrypt.hashpw(raw_password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(raw_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(raw_password.encode()[:72], hashed_password.encode())
    except ValueError:
        return False


def generate_api_token() -> str:
    return secrets.token_hex(40)  # 80 chars, matches original users.api_token VARCHAR(80)


def generate_tfa_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def sign_session(user_id: str) -> str:
    return _session_serializer.dumps({"user_id": user_id})


def unsign_session(token: str, max_age: int) -> str | None:
    try:
        data = _session_serializer.loads(token, max_age=max_age)
    except BadSignature:
        return None
    return data.get("user_id")


def stats_unlock_cookie_name(domain: str) -> str:
    return f"a2g_stats_unlock_{hashlib.md5(domain.encode()).hexdigest()}"


def sign_stats_unlock(domain: str) -> str:
    return _stats_unlock_serializer.dumps({"domain": domain})


def verify_stats_unlock(token: str, domain: str, max_age: int) -> bool:
    try:
        data = _stats_unlock_serializer.loads(token, max_age=max_age)
    except BadSignature:
        return False
    return data.get("domain") == domain


def encrypt_secret(plain: str) -> str:
    return _fernet.encrypt(plain.encode()).decode()


def decrypt_secret(token: str) -> str:
    return _fernet.decrypt(token.encode()).decode()
