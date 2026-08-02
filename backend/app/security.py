from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


bearer_scheme = HTTPBearer(auto_error=False)


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


@dataclass(slots=True)
class TokenService:
    secret: str
    ttl_seconds: int

    def create(self, user_id: str) -> str:
        payload = {
            "sub": user_id,
            "iat": int(time.time()),
            "exp": int(time.time()) + self.ttl_seconds,
        }
        encoded = _b64encode(
            json.dumps(payload, separators=(",", ":")).encode("utf-8")
        )
        signature = _b64encode(
            hmac.new(self.secret.encode(), encoded.encode(), hashlib.sha256).digest()
        )
        return f"{encoded}.{signature}"

    def verify(self, token: str) -> dict[str, Any]:
        try:
            encoded, signature = token.split(".", 1)
            expected = _b64encode(
                hmac.new(self.secret.encode(), encoded.encode(), hashlib.sha256).digest()
            )
            if not hmac.compare_digest(signature, expected):
                raise ValueError("invalid signature")
            payload = json.loads(_b64decode(encoded))
            if int(payload["exp"]) < int(time.time()):
                raise ValueError("expired token")
            return payload
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않거나 만료된 토큰입니다.",
            ) from exc


def hash_code(secret: str, code: str) -> str:
    return hmac.new(secret.encode(), code.encode(), hashlib.sha256).hexdigest()


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    payload = request.app.state.tokens.verify(credentials.credentials)
    data = request.app.state.store.snapshot()
    user = next(
        (
            item
            for item in data["users"]
            if item["id"] == payload["sub"] and item.get("status", "active") == "active"
        ),
        None,
    )
    if user is None:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return user


def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any] | None:
    if credentials is None:
        return None
    payload = request.app.state.tokens.verify(credentials.credentials)
    data = request.app.state.store.snapshot()
    user = next(
        (
            item
            for item in data["users"]
            if item["id"] == payload["sub"] and item.get("status", "active") == "active"
        ),
        None,
    )
    if user is None:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return user


def require_verified_user(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if not user["university_verified"]:
        raise HTTPException(status_code=403, detail="대학교 인증이 필요합니다.")
    return user

