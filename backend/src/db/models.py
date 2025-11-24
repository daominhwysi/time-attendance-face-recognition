from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from .session import Base
from sqlalchemy import func

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class FaceGroup(Base):
    __tablename__ = "face_groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    image_count = Column(Integer, default=1)

    # Keeping this as a "Cache" for the absolute last time seen
    last_seen_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    sightings = relationship("SightingLog", back_populates="face_group", cascade="all, delete-orphan")

class SightingLog(Base):
    __tablename__ = "sighting_logs"
    id = Column(Integer, primary_key=True, index=True)
    face_group_id = Column(Integer, ForeignKey("face_groups.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    face_group = relationship("FaceGroup", back_populates="sightings")
