from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from src.auth import get_current_active_user
from src.database import get_db
from src.models import FaceGroup, User

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    responses={404: {"description": "Not found"}},
)

class SightingRecord(BaseModel):
    name: str
    last_seen_at: Optional[datetime]

    class Config:
        orm_mode = True

@router.get("/sightings", response_model=List[SightingRecord])
def get_sightings_report(
    seen_after: Optional[datetime] = Query(None, description="ISO 8601 format. Filter for groups seen after this time."),
    not_seen_since: Optional[datetime] = Query(None, description="ISO 8601 format. Filter for groups not seen since this time."),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves a report of face groups based on when they were last seen.
    - `seen_after`: Shows all people seen at or after the specified time.
    - `not_seen_since`: Shows all people who have either never been seen, or whose
      last_seen_at is before the specified time.
    """
    if seen_after and not_seen_since:
        # To avoid conflicting queries, only one filter can be active.
        # You could also implement more complex logic if needed.
        return []

    query = db.query(FaceGroup).filter(FaceGroup.user_id == current_user.id)

    if seen_after:
        query = query.filter(FaceGroup.last_seen_at >= seen_after)
    elif not_seen_since:
        # This logic includes groups that are NULL (never seen) OR seen before the cutoff
        query = query.filter(
            (FaceGroup.last_seen_at == None) | (FaceGroup.last_seen_at < not_seen_since)
        )

    # Order by most recently seen for relevance
    query = query.order_by(FaceGroup.last_seen_at.desc().nulls_last())

    results = query.all()
    return results
