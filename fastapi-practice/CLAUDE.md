# CLAUDE.md

FastAPI backend with PostgreSQL (async SQLAlchemy + asyncpg) and Clerk authentication. Managed with uv, Python 3.12, `src/` layout (package `fastapi_practice`).

Requirements live in `../task.md` and as GitLab issues #1–#5 in `huyen.cao/claude-training` (labels `fastapi`, `practice`). Read the matching issue's scope and acceptance criteria before implementing a feature.

## Commands

```bash
uv sync                                  # install deps
docker compose up -d                     # Postgres on localhost:5432
uv run fastapi-practice                  # dev server with reload, :8000
uv run pytest                            # tests (no network, no DB needed)
uv run ruff check . && uv run ruff format .
uv add <pkg> / uv add --dev <pkg>        # never pip install
```

Run `pytest` and `ruff check` before saying work is done.

## Layout

- `main.py`: `create_app()`, router registration, lifespan disposes the engine
- `core/config.py`: `Settings` from env / `.env`, accessed via cached `get_settings()`
- `core/security.py`: `ClerkTokenVerifier`. It is framework-free and raises `InvalidTokenError` / `AuthServiceUnavailableError`
- `api/deps.py`: maps those errors to HTTP (401 / 503). `CurrentClaims` is the auth dependency for routes
- `db/session.py`: `Base`, `get_engine()`, `get_db()` session dependency
- `api/routes/`: one router per feature, registered in `main.py`

## Conventions

- Protect a route by adding a `claims: CurrentClaims` parameter. Don't verify tokens anywhere else.
- Keep HTTP concerns in `api/`. `core/` and `db/` must not import FastAPI.
- Use `Annotated[..., Depends(...)]` for dependencies.
- Singletons (settings, engine, verifier) are `@lru_cache` functions so tests can override them with `app.dependency_overrides`.
- Status codes: 401 for a missing, invalid or expired token; 403 for an authenticated user without permission or with a disabled account; 422 for validation errors. Don't let FastAPI's default 403 leak for missing credentials: `HTTPBearer` uses `auto_error=False` on purpose.

## Domain decisions (from task.md)

- Postgres is the source of truth for `role` (`admin`/`user`) and `status` (`active`/`disabled`). Clerk `publicMetadata` is a synced copy. Role and status checks read from the DB, never from token claims.
- When writing to both Clerk and the DB, call Clerk first and update the DB only if Clerk succeeds.
- Users can only read and edit their own profile (`/me`), Admins included. There is no endpoint to view or edit another user's profile.
- Register/login is handled by the frontend through the Clerk SDK. The backend has no register/login endpoints.

## Testing

- `tests/conftest.py` sets `CLERK_ISSUER` *before* importing the app, because `Settings` requires it. Keep that import order.
- Tokens are signed with a locally generated RSA key. `StaticKeyResolver` stands in for `PyJWKClient`. Never call real Clerk in tests.
- TestClient uses `httpx2` (Starlette deprecated `httpx`).

## Gotchas

- `PyJWKClient` does blocking HTTP, so auth dependencies are sync `def` (FastAPI runs them in a threadpool). Don't make them `async def`.
- `.env` is gitignored. Add new settings to both `Settings` and `.env.example`.
- There are no migrations yet. When adding the first table, set up Alembic rather than using `Base.metadata.create_all`.
