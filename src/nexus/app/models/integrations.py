from app.db.database import Base
from sqlalchemy import Column


class IntegrationManifest(Base):
    __tablename__ = "integration_manifests"

    id = Column()
