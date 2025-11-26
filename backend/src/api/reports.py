from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, and_
from sqlalchemy.orm import Session
from src.db.session import get_db
from src.db.models import FaceGroup, User, SightingLog
from src.core.security import get_current_active_user
from src.schemas.reports import AttendanceRow

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/attendance/custom", response_model=List[AttendanceRow])
def get_custom_attendance_report(
    start_time: datetime = Query(..., description="ISO Format Start Time"),
    end_time: datetime = Query(..., description="ISO Format End Time"),
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if end_time <= start_time:
        raise HTTPException(400, "End time must be after start time")

    # 1. Fetch ALL FaceGroups for this user (Query #1)
    # We select ID and Name specifically
    all_faces = db.query(FaceGroup.id, FaceGroup.name).filter_by(user_id=user.id).all()

    if not all_faces:
        return []

    face_ids = [f.id for f in all_faces]

    # 2. Bulk Fetch Statistics (Query #2)
    # Instead of querying inside a loop, we group by face_group_id
    stats_query = db.query(
        SightingLog.face_group_id,
        func.min(SightingLog.timestamp).label("first_seen"),
        func.max(SightingLog.timestamp).label("last_seen")
    ).filter(
        SightingLog.face_group_id.in_(face_ids),
        SightingLog.timestamp >= start_time,
        SightingLog.timestamp <= end_time
    ).group_by(
        SightingLog.face_group_id
    ).all()

    # 3. Convert DB Results to a Dictionary for O(1) Lookup
    # Map: { face_group_id: (first_seen, last_seen) }
    stats_map = {
        row.face_group_id: (row.first_seen, row.last_seen)
        for row in stats_query
    }

    results = []

    # 4. Merge Data in Memory
    for face_id, face_name in all_faces:

        # Check if we have stats for this person
        if face_id in stats_map:
            first_seen, last_seen = stats_map[face_id]
            status_text = "Present"

            # Calculate Duration
            duration = 0
            if last_seen and first_seen and last_seen > first_seen:
                diff = last_seen - first_seen
                duration = int(diff.total_seconds() / 60)

            results.append(AttendanceRow(
                name=face_name,
                first_seen=first_seen,
                last_seen=last_seen,
                total_duration_minutes=duration,
                status=status_text
            ))
        else:
            # No logs found for this person in the range -> Absent
            results.append(AttendanceRow(
                name=face_name,
                first_seen=None,
                last_seen=None,
                total_duration_minutes=0,
                status="Absent"
            ))

    return results
