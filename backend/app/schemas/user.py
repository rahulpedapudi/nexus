from pydantic import BaseModel, ConfigDict, EmailStr

from datetime import datetime


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    username: str
    email: EmailStr
    is_setup_complete: bool
    created_at: datetime
