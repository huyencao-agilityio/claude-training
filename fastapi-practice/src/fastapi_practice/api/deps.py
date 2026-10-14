from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from fastapi_practice.core.config import get_settings
from fastapi_practice.core.security import (
    AuthServiceUnavailableError,
    ClerkClaims,
    ClerkTokenVerifier,
    InvalidTokenError,
)

# auto_error=False so a missing header gives 401 (not FastAPI's default 403).
bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache
def get_token_verifier() -> ClerkTokenVerifier:
    settings = get_settings()
    return ClerkTokenVerifier(
        # Keys are cached in-process; an unknown `kid` triggers one refetch (key rotation).
        key_resolver=jwt.PyJWKClient(settings.jwks_url, cache_keys=True),
        issuer=settings.clerk_issuer,
        authorized_parties=settings.clerk_authorized_parties,
        leeway_seconds=settings.clerk_leeway_seconds,
    )


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    verifier: Annotated[ClerkTokenVerifier, Depends(get_token_verifier)],
) -> ClerkClaims:
    if credentials is None:
        raise _unauthorized("Not authenticated")
    try:
        return verifier.verify(credentials.credentials)
    except InvalidTokenError as exc:
        raise _unauthorized(str(exc)) from exc
    except AuthServiceUnavailableError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc


CurrentClaims = Annotated[ClerkClaims, Depends(get_current_claims)]
