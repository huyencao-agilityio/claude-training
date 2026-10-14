# fastapi-practice

FastAPI backend with PostgreSQL and Clerk authentication.

## Setup

```bash
uv sync                     # install deps into .venv
cp .env.example .env        # then set CLERK_ISSUER and CLERK_AUTHORIZED_PARTIES
docker compose up -d        # Postgres on localhost:5432
uv run fastapi-practice     # http://localhost:8000, docs at /docs
```

`CLERK_ISSUER` is the **Frontend API URL** from Clerk Dashboard → Configure → API keys.

## Endpoints

| Method | Path           | Auth   | Description                                        |
|--------|----------------|--------|----------------------------------------------------|
| GET    | `/health`      | none   | Checks the app and the Postgres connection         |
| GET    | `/auth/verify` | Bearer | Verifies a Clerk session token, returns its user   |

```bash
curl -H "Authorization: Bearer <clerk-session-token>" http://localhost:8000/auth/verify
```

Get a token from the frontend with `await window.Clerk.session.getToken()` in the browser console.

Token verification (`core/security.py`) checks the RS256 signature against Clerk's JWKS,
`exp`/`nbf`/`iat`, `iss`, and that `azp` is one of `CLERK_AUTHORIZED_PARTIES`.
Any failure returns `401`; an unreachable JWKS endpoint returns `503`.

To protect a route, depend on `CurrentClaims`:

```python
from fastapi_practice.api.deps import CurrentClaims

@router.get("/something")
def something(claims: CurrentClaims): ...
```

## Development

```bash
uv run pytest
uv run ruff check . && uv run ruff format .
```

## Layout

```
src/fastapi_practice/
  main.py            app factory, routers
  core/config.py     settings from env / .env
  core/security.py   Clerk JWT verification
  db/session.py      async SQLAlchemy engine, session, Base
  api/deps.py        auth dependencies (CurrentClaims)
  api/routes/        health, auth
tests/               token verification tests (no network, local RSA keys)
```
