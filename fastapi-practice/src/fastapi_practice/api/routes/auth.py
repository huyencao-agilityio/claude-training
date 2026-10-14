from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from fastapi_practice.api.deps import CurrentClaims

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenInfo(BaseModel):
    user_id: str
    session_id: str | None
    expires_at: datetime


@router.get("/verify", response_model=TokenInfo)
def verify_token(claims: CurrentClaims) -> TokenInfo:
    """Return the identity in the Clerk session token, or 401 if it is not valid."""
    return TokenInfo(user_id=claims.user_id, session_id=claims.session_id, expires_at=claims.expires_at)
