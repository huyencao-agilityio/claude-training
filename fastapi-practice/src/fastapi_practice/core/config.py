from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "fastapi-practice"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/fastapi_practice"

    # Clerk Frontend API URL, e.g. https://your-app.clerk.accounts.dev
    # It is the `iss` claim of every session token Clerk issues.
    clerk_issuer: str
    # Defaults to {clerk_issuer}/.well-known/jwks.json when empty.
    clerk_jwks_url: str = ""
    # Origins allowed in the `azp` claim, e.g. ["http://localhost:3000"].
    # Empty list disables the check (not recommended outside local dev).
    clerk_authorized_parties: list[str] = Field(default_factory=list)
    # Clock skew tolerance in seconds when checking exp/nbf/iat.
    clerk_leeway_seconds: int = 5

    @property
    def jwks_url(self) -> str:
        return self.clerk_jwks_url or f"{self.clerk_issuer.rstrip('/')}/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
