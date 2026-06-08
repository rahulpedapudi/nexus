from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # app settings
    APP_NAME: str = "Nexus"
    VERSION: str = "0.1.0"

    # auth settings
    SECRET_KEY: str = "18ad94a6a0034e4fc53d06eeaadcf816bd31529d91fe11f5d67373972d72b8ad"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7   # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"


settings = Settings()
