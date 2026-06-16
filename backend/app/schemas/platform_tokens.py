from pydantic import BaseModel

class PlatformTokenRequest(BaseModel):
    platform: str

class PlatformTokenResponse(BaseModel):
    token: str
    expires_at: str
    platform: str