import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT")

if not ENVIRONMENT:
    raise ValueError("ENVIRONMENT is not set, please set it in the .env file")

if ENVIRONMENT == "LOCAL":
    DATABASE_URL = os.getenv("LOCAL_DATABASE_URL")
else:
    DATABASE_URL = os.getenv("DATABASE_URL_POOLER") or os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db

    finally:
        db.close()
