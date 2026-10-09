from __future__ import annotations

import hashlib
import secrets
from typing import Any


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash or not password_hash.startswith("pbkdf2_sha256$"):
        return False
    _, salt, digest_hex = password_hash.split("$", 2)
    generated = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return generated.hex() == digest_hex


def generate_demo_token() -> str:
    return secrets.token_urlsafe(32)


def canonical_json(data: Any) -> str:
    import json

    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
