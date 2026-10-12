from dataclasses import dataclass
from typing import Annotated

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None
    role: str | None


async def _user_via_supabase(token: str) -> AuthUser | None:
    if not settings.supabase_url or not settings.supabase_anon_key:
        return None

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": settings.supabase_anon_key,
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, headers=headers)
    except httpx.HTTPError:
        return None

    if response.status_code != 200:
        return None

    payload = response.json()
    user_id = payload.get("id")
    if not user_id:
        return None

    return AuthUser(
        id=str(user_id),
        email=payload.get("email"),
        role=payload.get("role"),
    )


def _user_via_jwt_secret(token: str) -> AuthUser | None:
    if not settings.supabase_jwt_secret:
        return None

    # UUID-shaped values are almost never the real JWT secret
    secret = settings.supabase_jwt_secret.strip()
    if len(secret) == 36 and secret.count("-") == 4:
        return None

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    return AuthUser(
        id=str(user_id),
        email=payload.get("email"),
        role=payload.get("role"),
    )


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> AuthUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = credentials.credentials
    user = await _user_via_supabase(token)
    if user is None:
        user = _user_via_jwt_secret(token)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return user


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
