import io
import uuid
import asyncio
import numpy as np
import cv2
from PIL import Image
from fastapi import UploadFile
from qdrant_client import models as qdrant_models

from src.core.ml_models import ml_models
from src.db.qdrant import get_qdrant_client, IMAGE_COLLECTION_NAME
from src.services.r2_service import upload_img_to_r2, delete_img_from_r2
from src.schemas.images import UploadResult, SearchResult, UpdateGroupNameResponse
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from src.db.models import FaceGroup, User

# --- NEW: Step 1 - Detect Only (Returns Data needed for upload) ---
async def analyze_face_from_file(file: UploadFile, label: str):
    """
    Reads file, detects face, generates embedding.
    Does NOT upload to R2 yet.
    Returns: (embedding, pil_image, filename, label, content_type) or None
    """
    try:
        # 1. Read Image
        image_bytes = await file.read()
        image_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        np_img = cv2.cvtColor(np.array(image_pil), cv2.COLOR_RGB2BGR)

        # 2. Embed (CPU Bound -> Thread)
        embedding, _ = await asyncio.to_thread(
            generate_embedding_helper, np_img
        )

        if embedding is None:
            return None # Failed detection

        return {
            "embedding": embedding,
            "image": image_pil,
            "filename": file.filename,
            "label": label,
            "content_type": file.content_type
        }
    except Exception as e:
        print(f"Error processing {file.filename}: {e}")
        return None

# --- NEW: Step 2 - Upload & Create Point (I/O Bound) ---
async def upload_and_create_point(data: dict, username: str):
    """
    Takes the result from analyze_face_from_file, uploads to R2, returns Qdrant Point.
    """
    try:
        # 3. Upload R2 (This waits for Network I/O)
        image_url = await upload_img_to_r2(data["image"])

        # 4. Prepare Point
        point_id = str(uuid.uuid4())
        point = qdrant_models.PointStruct(
            id=point_id,
            vector=data["embedding"].tolist(),
            payload={
                "image_url": image_url,
                "user_id": username,
                "content_type": data["content_type"],
                "name": data["label"]
            }
        )

        # Return Tuple: (QdrantPoint, SuccessResponse)
        return point, UploadResult(point_id=point_id, filename=data["filename"], label=data["label"])

    except Exception as e:
        print(f"Upload failed for {data['filename']}: {e}")
        return None

# ... keep generate_embedding_helper and other functions as is ...
min_face_size = 50

def generate_embedding_helper(image: np.ndarray):
    """Sync function to be run in thread."""
    detector = ml_models.detector
    recognizer = ml_models.recognizer

    faces = detector.detect(image)
    largest_face = None
    max_area = 0
    for face in faces:
        x1, y1, x2, y2 = map(int, face["bbox"])
        width, height = x2 - x1, y2 - y1
        if width < min_face_size or height < min_face_size:
            continue
        area = width * height
        if area > max_area:
            max_area = area
            largest_face = face

    if largest_face is None:
        return None, None

    try:
        np_landmarks = np.array(largest_face['landmarks'])
        embedding = recognizer.get_normalized_embedding(image=image, landmarks=np_landmarks)
        return embedding[0], largest_face
    except Exception as e:
        print(f"Embedding error: {e}")
        return None, None

# ... keep search_faces_by_image, delete_face_logic, etc ...
async def search_faces_by_image(file_bytes: bytes, username: str) -> list[SearchResult]:
    # ... existing code ...
    try:
        image_pil = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        np_img = cv2.cvtColor(np.array(image_pil), cv2.COLOR_RGB2BGR)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid image file")

    embedding, _ = await asyncio.to_thread(generate_embedding_helper, np_img)

    if embedding is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No face detected in search image")

    qdrant = get_qdrant_client()
    hits = await qdrant.query_points(
        collection_name=IMAGE_COLLECTION_NAME,
        query=embedding.tolist(),
        query_filter=qdrant_models.Filter(
            must=[qdrant_models.FieldCondition(key="user_id", match=qdrant_models.MatchValue(value=username))]
        ),
        limit=5,
        score_threshold=0.4
    )

    return [
        SearchResult(id=point.id, score=point.score, **point.payload)
        for point in hits.points
    ]

# ... Keep delete_face_logic, rename_face_group_logic, delete_entire_group_logic as is ...
async def delete_face_logic(point_id: str, user: User, db: Session):
    qdrant = get_qdrant_client()
    points = await qdrant.retrieve(IMAGE_COLLECTION_NAME, ids=[point_id])
    if not points:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Face not found")
    point = points[0]
    if point.payload.get("user_id") != user.username:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to delete this face")
    if img_url := point.payload.get("image_url"):
        await delete_img_from_r2(img_url)
    label = point.payload.get("name")
    if label:
        group = db.query(FaceGroup).filter_by(name=label, user_id=user.id).first()
        if group:
            if group.image_count > 1:
                group.image_count -= 1
            else:
                db.delete(group)
            db.commit()
    await qdrant.delete(
        collection_name=IMAGE_COLLECTION_NAME,
        points_selector=qdrant_models.PointIdsList(points=[point_id])
    )

async def rename_face_group_logic(point_id: str, new_name: str, user: User, db: Session) -> UpdateGroupNameResponse:
    qdrant = get_qdrant_client()
    new_name = new_name.strip()
    points = await qdrant.retrieve(IMAGE_COLLECTION_NAME, ids=[point_id])
    if not points or points[0].payload.get("user_id") != user.username:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Face not found or unauthorized")
    old_name = points[0].payload.get("name")
    if old_name == new_name:
        group = db.query(FaceGroup).filter_by(name=new_name, user_id=user.id).first()
        return UpdateGroupNameResponse(message="No change", updated_group_name=new_name, image_count=group.image_count if group else 0)
    records, _ = await qdrant.scroll(
        collection_name=IMAGE_COLLECTION_NAME,
        scroll_filter=qdrant_models.Filter(
            must=[
                qdrant_models.FieldCondition(key="user_id", match=qdrant_models.MatchValue(value=user.username)),
                qdrant_models.FieldCondition(key="name", match=qdrant_models.MatchValue(value=old_name))
            ]
        ),
        limit=10000
    )
    if not records:
         raise HTTPException(status.HTTP_404_NOT_FOUND, "Group seems empty in vector DB")
    await qdrant.set_payload(
        collection_name=IMAGE_COLLECTION_NAME,
        payload={"name": new_name},
        points=[r.id for r in records],
        wait=True
    )
    old_group = db.query(FaceGroup).filter_by(name=old_name, user_id=user.id).first()
    target_group = db.query(FaceGroup).filter_by(name=new_name, user_id=user.id).first()
    final_count = len(records)
    if target_group:
        target_group.image_count += old_group.image_count if old_group else final_count
        if old_group:
            db.delete(old_group)
        final_count = target_group.image_count
    else:
        if old_group:
            old_group.name = new_name
            final_count = old_group.image_count
        else:
            db.add(FaceGroup(name=new_name, user_id=user.id, image_count=final_count))
    db.commit()
    return UpdateGroupNameResponse(
        message="Group renamed successfully",
        updated_group_name=new_name,
        image_count=final_count
    )

async def delete_entire_group_logic(group_id: int, user: User, db: Session):
    qdrant = get_qdrant_client()
    group = db.query(FaceGroup).filter_by(id=group_id, user_id=user.id).first()
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Person/Group not found")
    group_name = group.name
    try:
        points, _ = await qdrant.scroll(
            collection_name=IMAGE_COLLECTION_NAME,
            scroll_filter=qdrant_models.Filter(
                must=[
                    qdrant_models.FieldCondition(key="user_id", match=qdrant_models.MatchValue(value=user.username)),
                    qdrant_models.FieldCondition(key="name", match=qdrant_models.MatchValue(value=group_name))
                ]
            ),
            limit=100
        )
        for point in points:
            if url := point.payload.get("image_url"):
                await delete_img_from_r2(url)
    except Exception as e:
        print(f"Warning: R2 cleanup failed partially: {e}")
    await qdrant.delete(
        collection_name=IMAGE_COLLECTION_NAME,
        points_selector=qdrant_models.FilterSelector(
            filter=qdrant_models.Filter(
                must=[
                    qdrant_models.FieldCondition(key="user_id", match=qdrant_models.MatchValue(value=user.username)),
                    qdrant_models.FieldCondition(key="name", match=qdrant_models.MatchValue(value=group_name))
                ]
            )
        )
    )
    db.delete(group)
    db.commit()
    return {"message": f"Person '{group_name}' and all associated data deleted."}
