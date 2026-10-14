"""Verification of Clerk session tokens (RS256 JWTs signed with the instance's JWKS)."""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

import jwt


class InvalidTokenError(Exception):
    """The token is missing, malformed, expired, or not issued for this app."""


class AuthServiceUnavailableError(Exception):
    """Clerk's JWKS endpoint could not be reached, so the token cannot be checked."""


class SigningKeyResolver(Protocol):
    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK: ...


@dataclass(frozen=True)
class ClerkClaims:
    user_id: str
    session_id: str | None
    issued_at: datetime
    expires_at: datetime
    raw: dict[str, Any]


class ClerkTokenVerifier:
    def __init__(
        self,
        key_resolver: SigningKeyResolver,
        issuer: str,
        authorized_parties: list[str],
        leeway_seconds: int = 5,
    ) -> None:
        self._key_resolver = key_resolver
        self._issuer = issuer.rstrip("/")
        self._authorized_parties = set(authorized_parties)
        self._leeway = leeway_seconds

    def verify(self, token: str) -> ClerkClaims:
        try:
            signing_key = self._key_resolver.get_signing_key_from_jwt(token)
        except jwt.PyJWKClientConnectionError as exc:
            raise AuthServiceUnavailableError("Cannot fetch Clerk JWKS") from exc
        except (jwt.PyJWKClientError, jwt.DecodeError) as exc:
            # Unknown `kid` or a header that is not a JWT at all.
            raise InvalidTokenError("Invalid token") from exc

        try:
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                issuer=self._issuer,
                leeway=self._leeway,
                options={"require": ["exp", "iat", "nbf", "iss", "sub"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise InvalidTokenError("Token expired") from exc
        except jwt.InvalidTokenError as exc:
            raise InvalidTokenError("Invalid token") from exc

        # Clerk recommends checking `azp` to stop tokens minted for other origins
        # from being replayed against this API.
        azp = payload.get("azp")
        if self._authorized_parties and azp not in self._authorized_parties:
            raise InvalidTokenError("Invalid authorized party")

        return ClerkClaims(
            user_id=payload["sub"],
            session_id=payload.get("sid"),
            issued_at=datetime.fromtimestamp(payload["iat"], tz=UTC),
            expires_at=datetime.fromtimestamp(payload["exp"], tz=UTC),
            raw=payload,
        )
