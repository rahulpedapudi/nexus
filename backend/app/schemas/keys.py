from pydantic import BaseModel


class KeyCreate(BaseModel):
    provider: str
    key: str
