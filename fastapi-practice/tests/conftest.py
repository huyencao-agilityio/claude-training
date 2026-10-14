import os
import time
from collections.abc import Callable, Iterator
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

os.environ.setdefault("CLERK_ISSUER", "https://test.clerk.accounts.dev")

from fastapi_practice.api.deps import get_token_verifier  # noqa: E402
from fastapi_practice.core.security import ClerkTokenVerifier  # noqa: E402
from fastapi_practice.main import app  # noqa: E402

ISSUER = "https://test.clerk.accounts.dev"
AUTHORIZED_PARTY = "http://localhost:3000"
KID = "test-kid"


class StaticKeyResolver:
    """Stands in for PyJWKClient: serves one public key, rejects unknown kids."""

    def __init__(self, public_key: rsa.RSAPublicKey) -> None:
        self._jwk = jwt.PyJWK.from_dict({**jwt.algorithms.RSAAlgorithm.to_jwk(public_key, as_dict=True), "kid": KID})

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
        if jwt.get_unverified_header(token).get("kid") != KID:
            raise jwt.PyJWKClientError("Unable to find a signing key that matches")
        return self._jwk


@pytest.fixture(scope="session")
def private_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def make_token(private_key: rsa.RSAPrivateKey) -> Callable[..., str]:
    def _make(key: rsa.RSAPrivateKey | None = None, kid: str = KID, **overrides: Any) -> str:
        now = int(time.time())
        claims = {
            "sub": "user_123",
            "sid": "sess_456",
            "iss": ISSUER,
            "azp": AUTHORIZED_PARTY,
            "iat": now,
            "nbf": now,
            "exp": now + 60,
        }
        claims.update(overrides)
        claims = {k: v for k, v in claims.items() if v is not None}
        return jwt.encode(claims, key or private_key, algorithm="RS256", headers={"kid": kid})

    return _make


@pytest.fixture
def client(private_key: rsa.RSAPrivateKey) -> Iterator[TestClient]:
    verifier = ClerkTokenVerifier(
        key_resolver=StaticKeyResolver(private_key.public_key()),
        issuer=ISSUER,
        authorized_parties=[AUTHORIZED_PARTY],
        leeway_seconds=0,
    )
    app.dependency_overrides[get_token_verifier] = lambda: verifier
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
