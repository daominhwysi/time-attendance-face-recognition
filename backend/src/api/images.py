import asyncio
from typing import List
from collections import Counter
from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, Query, Path, Body, status
from sqlalchemy.orm import Session
from src.db.session import get_db
from src.db.qdrant import get_qdrant_client, IMAGE_COLLECTION_NAME
from src.db.models import FaceGroup, User
from src.core.security import get_current_active_user
# Import the new split functions
from src.services.face_service import (
    analyze_face_from_file,
    upload_and_create_point,
    search_faces_by_image,
    delete_face_logic,
    rename_face_group_logic,
    delete_entire_group_logic
)
from src.schemas.images import (
  MultiUploadResponse,
  PaginatedGroupResponse,
  FaceRecord,
  GroupedFaceResponse,
  UpdateGroupName,
  UpdateGroupNameResponse,
  SearchResult
)
from qdrant_client import models as qdrant_models

router = APIRouter(prefix="/images", tags=["images"])

@router.post("/upload-faces", response_model=MultiUploadResponse)
async def upload_faces(
    files: List[UploadFile] = File(...),
    labels: List[str] = Form(...),
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if len(files) != len(labels):
        raise HTTPException(400, "Files vs Labels mismatch")

    qdrant = get_qdrant_client()

    # 1. Analysis Phase (CPU Bound - keep semi-sequential or small batch)
    # We iterate and detect faces first. This loads images into memory.
    ready_to_upload = []
    failed_filenames = []

    for file, label in zip(files, labels):
        # analyze_face_from_file returns dict or None
        data = await analyze_face_from_file(file, label)
        if data:
            ready_to_upload.append(data)
        else:
            failed_filenames.append(file.filename or "unknown")

    # 2. Upload Phase (I/O Bound - Parallel)
    # If we have valid faces, upload them all at once
    successful_results = []
    points_to_upsert = []

    if ready_to_upload:
        # Create a list of coroutines
        tasks = [upload_and_create_point(item, user.username) for item in ready_to_upload]

        # Execute in parallel
        results = await asyncio.gather(*tasks)

        # Process results
        for res in results:
            if res:
                point, upload_res = res
                points_to_upsert.append(point)
                successful_results.append(upload_res)
            else:
                # In rare case upload failed after detection succeeded
                # We can't identify exactly which filename here easily without logic change,
                # but it's handled in the service log.
                pass

    # 3. Database Update Phase
    if points_to_upsert:
        # A. Qdrant Bulk Upsert
        await qdrant.upsert(IMAGE_COLLECTION_NAME, points=points_to_upsert)

        # B. SQL Grouping Updates (Optimized Counter Logic)
        label_counts = Counter([res.label for res in successful_results])

        for label, count in label_counts.items():
            group = db.query(FaceGroup).filter_by(name=label, user_id=user.id).first()
            if group:
                group.image_count += count
            else:
                db.add(FaceGroup(name=label, user_id=user.id, image_count=count))

        db.commit()

    return MultiUploadResponse(
        message="Done",
        successful_uploads=successful_results,
        failed_uploads=failed_filenames
    )

# ... rest of the endpoints (get_grouped_faces, search, etc) remain unchanged ...
@router.get("/my-faces/grouped", response_model=PaginatedGroupResponse)
async def get_grouped_faces(
    page: int = 1, page_size: int = 10,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    offset = (page - 1) * page_size
    total = db.query(FaceGroup).filter_by(user_id=user.id).count()
    groups = db.query(FaceGroup).filter_by(user_id=user.id).order_by(FaceGroup.created_at.desc()).offset(offset).limit(page_size).all()

    # Fetch images from Qdrant
    qdrant = get_qdrant_client()
    names = [g.name for g in groups]
    records, _ = await qdrant.scroll(
        IMAGE_COLLECTION_NAME,
        scroll_filter=qdrant_models.Filter(
            must=[qdrant_models.FieldCondition(key="user_id", match=qdrant_models.MatchValue(value=user.username))],
            should=[qdrant_models.FieldCondition(key="name", match=qdrant_models.MatchValue(value=n)) for n in names]
        ), limit=500
    )

    img_map = {n: [] for n in names}
    for r in records:
        if r.payload["name"] in img_map:
            img_map[r.payload["name"]].append(FaceRecord(id=r.id, **r.payload))

    items = [GroupedFaceResponse(id=g.id, name=g.name, image_count=g.image_count, images=img_map.get(g.name, [])) for g in groups]
    return PaginatedGroupResponse(items=items, total_groups=total, page=page, page_size=page_size)

@router.post("/search-face", response_model=List[SearchResult])
async def search_faces(
    file: UploadFile = File(...),
    user: User = Depends(get_current_active_user)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File must be an image")

    content = await file.read()
    return await search_faces_by_image(content, user.username)


@router.delete("/{point_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_face(
    point_id: str = Path(...),
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    await delete_face_logic(point_id, user, db)


@router.put("/rename-group/{point_id}", response_model=UpdateGroupNameResponse)
async def rename_face_group(
    point_id: str = Path(..., description="ID of any face within the group to be renamed"),
    update_data: UpdateGroupName = Body(...),
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return await rename_face_group_logic(point_id, update_data.name, user, db)


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_face_group(
    group_id: int = Path(..., description="The ID of the FaceGroup (Person) to delete"),
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Deletes the entire person (SQL Group), all their Vector embeddings, and R2 images.
    """
    await delete_entire_group_logic(group_id, user, db)
