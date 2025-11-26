from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class WindowCreate(BaseModel):
    name: str
    start_time: datetime
    end_time: datetime

class WindowResponse(WindowCreate):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class AttendanceRow(BaseModel):
    name: str
    first_seen: Optional[datetime]
    last_seen: Optional[datetime]
    total_duration_minutes: Optional[int]
    status: str

