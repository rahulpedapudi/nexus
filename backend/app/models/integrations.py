from app.db.database import Base
from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import Mapped


class IntegrationManifest(Base):
    __tablename__ = "integration_manifests"

    id = Column(
        
    )