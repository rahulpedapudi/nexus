from pydantic_settings import BaseSettings
import os
from dotenv import load_dotenv


load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")


class Settings(BaseSettings):
    # app settings
    APP_NAME: str = "Nexus"
    VERSION: str = "0.1.0"

    # auth settings
    SECRET_KEY: str = JWT_SECRET

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7   # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"


settings = Settings()
