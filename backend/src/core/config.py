from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    SECRET_KEY: str = "unsafe_default_key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_URL: str = "http://localhost:5173"

    # Database
    DATABASE_URL: str

    # R2 / S3
    ENDPOINT_URL_R2: str
    AWS_ACCESS_KEY_ID_R2: str
    AWS_SECRET_ACCESS_KEY_R2: str
    PUBLIC_URL_R2: str

    class Config:
        env_file = ".env"

settings = Settings()
