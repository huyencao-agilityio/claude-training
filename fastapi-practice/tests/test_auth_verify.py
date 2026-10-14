import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

URL = "/auth/verify"


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_valid_token_returns_identity(client, make_token):
    res = client.get(URL, headers=auth(make_token()))

    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == "user_123"
    assert body["session_id"] == "sess_456"


def test_missing_token_returns_401(client):
    res = client.get(URL)

    assert res.status_code == 401
    assert res.headers["www-authenticate"] == "Bearer"


def test_non_bearer_scheme_returns_401(client, make_token):
    res = client.get(URL, headers={"Authorization": f"Basic {make_token()}"})

    assert res.status_code == 401


def test_expired_token_returns_401(client, make_token):
    now = int(time.time())
    token = make_token(iat=now - 120, nbf=now - 120, exp=now - 60)

    res = client.get(URL, headers=auth(token))

    assert res.status_code == 401
    assert res.json()["detail"] == "Token expired"


@pytest.mark.parametrize(
    "token",
    [
        "not-a-jwt",
        "a.b.c",
    ],
)
def test_malformed_token_returns_401(client, token):
    assert client.get(URL, headers=auth(token)).status_code == 401


def test_token_signed_by_other_key_returns_401(client, make_token):
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    assert client.get(URL, headers=auth(make_token(key=other_key))).status_code == 401


def test_unknown_kid_returns_401(client, make_token):
    assert client.get(URL, headers=auth(make_token(kid="rotated-away"))).status_code == 401


def test_wrong_issuer_returns_401(client, make_token):
    token = make_token(iss="https://evil.clerk.accounts.dev")

    assert client.get(URL, headers=auth(token)).status_code == 401


def test_unauthorized_party_returns_401(client, make_token):
    token = make_token(azp="https://evil.example.com")

    assert client.get(URL, headers=auth(token)).status_code == 401


@pytest.mark.parametrize("claim", ["sub", "exp", "iat", "nbf", "iss"])
def test_missing_required_claim_returns_401(client, make_token, claim):
    assert client.get(URL, headers=auth(make_token(**{claim: None}))).status_code == 401


def test_hs256_token_is_rejected(client):
    # Algorithm-confusion guard: only RS256 is accepted.
    now = int(time.time())
    token = jwt.encode(
        {"sub": "user_123", "iss": "https://test.clerk.accounts.dev", "iat": now, "nbf": now, "exp": now + 60},
        "a-shared-secret-that-is-at-least-32-bytes-long",
        algorithm="HS256",
        headers={"kid": "test-kid"},
    )

    assert client.get(URL, headers=auth(token)).status_code == 401


def test_jwks_unreachable_returns_503(client, make_token, monkeypatch):
    from fastapi_practice.api.deps import get_token_verifier
    from fastapi_practice.main import app

    verifier = app.dependency_overrides[get_token_verifier]()

    def boom(_token):
        raise jwt.PyJWKClientConnectionError("down")

    monkeypatch.setattr(verifier._key_resolver, "get_signing_key_from_jwt", boom)

    assert client.get(URL, headers=auth(make_token())).status_code == 503
