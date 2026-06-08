from pydantic import BaseModel, EmailStr

from datetime import datetime


class UserResponse(BaseModel):
    username: str
    email: EmailStr
    created_at: datetime
