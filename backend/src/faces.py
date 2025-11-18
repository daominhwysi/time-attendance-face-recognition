import io
import uuid
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status, Form, Path, Body, Query
from pydantic import Field
from typing import List

import cv2
import numpy as np
from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    UploadFile,
    status,
)
from PIL import Image
from sqlalchemy.orm import Session

from lib.uniface.detection.srcfd import SCRFD
from lib.uniface.recogition.models import ArcFace
from qdrant_client import models as qdrant_models
from src.auth import get_current_active_user
from src.models import FaceGroup, User
from src.qdrant_client import get_qdrant_client, IMAGE_COLLECTION_NAME
from src.schemas import BaseModel
from src.utils import upload_img_to_r2, generate_embedding_for_largest_face, delete_img_from_r2
from src.database import get_db
from src.schemas import BaseModel

# --- UTILITY FUNCTION (Unchanged) ---


router = APIRouter(
    prefix="/images",
    tags=["images"],
    responses={404: {"description": "Not found"}},
)

# --- MODELS FOR API RESPONSE (Updated) ---
class UploadResult(BaseModel):
    point_id: str
    filename: str
    label: str

class MultiUploadResponse(BaseModel):
    message: str
    successful_uploads: List[UploadResult]
    failed_uploads: List[str]

class FaceRecord(BaseModel):
    id: str
    name: str
    image_url: str

class UpdateFaceName(BaseModel):
    name: str

class SearchResult(BaseModel):
    id: str
    name: str
    image_url: str
    score: float

# --- LOAD ML MODELS ---
detector = SCRFD(model_path="models/scrfd_500m_kps.onnx")
recognizer = ArcFace(model_path="models/w600k_mbf.onnx")

# --- API ENDPOINTS ---

@router.post("/upload-faces", response_model=MultiUploadResponse)
async def upload_faces(
    files: List[UploadFile] = File(...),
    labels: List[str] = Form(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if len(files) != len(labels):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số lượng file ({len(files)}) và số lượng nhãn ({len(labels)}) không khớp."
        )
    qdrant_client = get_qdrant_client()
    points_to_upsert = []
    successful_results = []
    failed_filenames = []

    for file, label in zip(files, labels):
        filename = file.filename or "unknown_file"
        if not file.content_type or not file.content_type.startswith("image/"):
            failed_filenames.append(filename)
            continue
        try:
            image_bytes = await file.read()
            image_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            image_url = await upload_img_to_r2(image_pil)
            np_image = np.array(image_pil)
            np_bgr_img = cv2.cvtColor(np_image, cv2.COLOR_RGB2BGR)

            embedding_vector, _ = generate_embedding_for_largest_face(np_bgr_img, detector, recognizer)
            if embedding_vector is None:
                failed_filenames.append(filename)
                continue

            point_id = str(uuid.uuid4())
            point = qdrant_models.PointStruct(
                id=point_id,
                vector=embedding_vector.tolist(),
                payload={
                    "image_url": image_url,
                    "user_id": current_user.username,
                    "content_type": file.content_type,
                    "name": label
                }
            )
            points_to_upsert.append(point)
            successful_results.append(UploadResult(point_id=point_id, filename=filename, label=label))
        except Exception as e:
            print(f"Lỗi khi xử lý file {filename}: {e}")
            failed_filenames.append(filename)

    if points_to_upsert:
        qdrant_client.upsert(collection_name=IMAGE_COLLECTION_NAME, points=points_to_upsert, wait=True)
        label_counts = {}
        for result in successful_results:
            label_counts[result.label] = label_counts.get(result.label, 0) + 1

        for label, count in label_counts.items():
            # Kiểm tra xem nhóm đã tồn tại cho user này chưa
            group = db.query(FaceGroup).filter_by(name=label, user_id=current_user.id).first()
            if group:
                # Nếu có, cập nhật số lượng
                group.image_count += count
            else:
                # Nếu chưa, tạo mới
                new_group = FaceGroup(name=label, user_id=current_user.id, image_count=count)
                db.add(new_group)
        db.commit()

    return MultiUploadResponse(
        message=f"Đã xử lý xong. Thành công: {len(successful_results)}, Thất bại: {len(failed_filenames)}.",
        successful_uploads=successful_results,
        failed_uploads=failed_filenames
    )

# --- NEW ENDPOINTS FOR MANAGEMENT ---
class GroupedFaceResponse(BaseModel):
    name: str
    images: List[FaceRecord]
    image_count: int

class PaginatedGroupResponse(BaseModel):
    items: List[GroupedFaceResponse]
    total_groups: int
    page: int
    page_size: int

# API ENDPOINT MỚI
@router.get("/my-faces/grouped", response_model=PaginatedGroupResponse)
def get_my_faces_grouped(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50)
):
    """
    Lấy danh sách các nhóm khuôn mặt đã được phân trang hiệu quả.
    """
    qdrant_client = get_qdrant_client()
    # === BƯỚC 1: TRUY VẤN CHỈ MỤC NHANH ĐỂ LẤY CÁC NHÓM CỦA TRANG HIỆN TẠI ===
    offset = (page - 1) * page_size

    # Đếm tổng số nhóm
    total_groups = db.query(FaceGroup).filter_by(user_id=current_user.id).count()

    # Lấy các nhóm cho trang này, sắp xếp theo ngày tạo
    groups_for_page = db.query(FaceGroup).filter_by(user_id=current_user.id).order_by(FaceGroup.created_at.desc()).offset(offset).limit(page_size).all()

    if not groups_for_page:
        return PaginatedGroupResponse(items=[], total_groups=total_groups, page=page, page_size=page_size)

    group_names = [g.name for g in groups_for_page]

    # === BƯỚC 2: TRUY VẤN QDRANT ĐỂ LẤY TẤT CẢ ẢNH CỦA CÁC NHÓM ĐÓ ===
    # Sử dụng bộ lọc "should" (OR) để lấy ảnh của nhiều nhóm cùng lúc
    records, _ = qdrant_client.scroll(
        collection_name=IMAGE_COLLECTION_NAME,
        scroll_filter=qdrant_models.Filter(
            must=[
                qdrant_models.FieldCondition(key="user_id", match=qdrant_models.MatchValue(value=current_user.username))
            ],
            should=[
                qdrant_models.FieldCondition(key="name", match=qdrant_models.MatchValue(value=name)) for name in group_names
            ]
        ),
        limit=1000 # Lấy đủ ảnh cho các nhóm
    )

    # === BƯỚC 3: NHÓM DỮ LIỆU LẠI TRONG PYTHON ===
    images_by_group = {name: [] for name in group_names}
    for rec in records:
        name = rec.payload.get("name")
        if name in images_by_group:
            images_by_group[name].append(FaceRecord(id=rec.id, **rec.payload))

    # Tạo response cuối cùng
    response_items = []
    for group in groups_for_page:
        response_items.append(
            GroupedFaceResponse(
                name=group.name,
                image_count=group.image_count,
                images=images_by_group.get(group.name, [])
            )
        )

    return PaginatedGroupResponse(
        items=response_items,
        total_groups=total_groups,
        page=page,
        page_size=page_size
    )

@router.delete("/{point_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_face(
    point_id: str = Path(..., description="ID của điểm vector cần xóa"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    qdrant_client = get_qdrant_client()
    """Xóa một bản ghi khuôn mặt. Đảm bảo bản ghi đó thuộc về người dùng."""
    points = qdrant_client.retrieve(collection_name=IMAGE_COLLECTION_NAME, ids=[point_id])
    if not points:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Face record not found")

    point = points[0]
    if point.payload.get("user_id") != current_user.username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this record")
    label_to_update = point.payload.get("name")
    if label_to_update:
        group = db.query(FaceGroup).filter_by(name=label_to_update, user_id=current_user.id).first()
        if group:
            if group.image_count > 1:
                group.image_count -= 1
            else:
                # Nếu là ảnh cuối cùng, xóa cả nhóm
                db.delete(group)
            db.commit()
    # Xóa ảnh khỏi R2
    old_image_url = point.payload.get("image_url")
    if old_image_url:
        await delete_img_from_r2(old_image_url)

    # Xóa ảnh khỏi vector db
    qdrant_client.delete(
        collection_name=IMAGE_COLLECTION_NAME,
        points_selector=qdrant_models.PointIdsList(points=[point_id])
    )



    return

class UpdateGroupName(BaseModel):
    name: str = Field(..., description="Tên mới cho cả nhóm khuôn mặt.")

class UpdateGroupNameResponse(BaseModel):
    message: str
    updated_group_name: str
    image_count: int

@router.put("/rename-group/{point_id}", response_model=UpdateGroupNameResponse, tags=["images"])
async def rename_face_group(
    point_id: str = Path(..., description="ID của một điểm vector bất kỳ trong nhóm cần đổi tên"),
    update_data: UpdateGroupName = Body(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Đổi tên toàn bộ nhóm khuôn mặt dựa trên một ảnh đại diện.
    Hành động này sẽ cập nhật tất cả các bản ghi ảnh có cùng tên cũ
    và đồng bộ hóa bảng FaceGroup trong SQL.
    """
    qdrant_client = get_qdrant_client()
    new_name = update_data.name.strip()

    # --- BƯỚC 1: Lấy thông tin điểm ban đầu và tên cũ ---
    initial_points = qdrant_client.retrieve(collection_name=IMAGE_COLLECTION_NAME, ids=[point_id], with_payload=True)
    if not initial_points:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Face record not found")

    point = initial_points[0]
    if point.payload.get("user_id") != current_user.username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this record")

    old_name = point.payload.get("name")
    if not old_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Record does not have a name to update.")

    if old_name == new_name:
        group_info = db.query(FaceGroup).filter_by(name=old_name, user_id=current_user.id).first()
        return UpdateGroupNameResponse(
            message="New name is the same as the old name. No changes made.",
            updated_group_name=new_name,
            image_count=group_info.image_count if group_info else 0
        )

    # --- BƯỚC 2: Tìm tất cả các điểm trong nhóm cũ ---
    records, _ = qdrant_client.scroll(
        collection_name=IMAGE_COLLECTION_NAME,
        scroll_filter=qdrant_models.Filter(
            must=[
                qdrant_models.FieldCondition(key="user_id", match=qdrant_models.MatchValue(value=current_user.username)),
                qdrant_models.FieldCondition(key="name", match=qdrant_models.MatchValue(value=old_name))
            ]
        ),
        limit=10000 # Giới hạn hợp lý để tránh query vô hạn
    )

    point_ids_to_update = [rec.id for rec in records]
    if not point_ids_to_update:
        # Nếu không có điểm nào trong Qdrant, có thể dữ liệu không nhất quán.
        # Ta vẫn nên thử dọn dẹp SQL
        old_group_sql = db.query(FaceGroup).filter_by(name=old_name, user_id=current_user.id).first()
        if old_group_sql:
            db.delete(old_group_sql)
            db.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No images found for group '{old_name}' to rename.")


    # --- BƯỚC 3: Cập nhật tất cả các điểm trong Qdrant ---
    qdrant_client.set_payload(
        collection_name=IMAGE_COLLECTION_NAME,
        payload={"name": new_name},
        points=point_ids_to_update,
        wait=True
    )

    # --- BƯỚC 4: Xử lý logic cập nhật trong SQL ---
    old_group_sql = db.query(FaceGroup).filter_by(name=old_name, user_id=current_user.id).first()
    if not old_group_sql:
        # Dữ liệu không nhất quán, tạo lại bản ghi group mới
        new_group_sql = FaceGroup(name=new_name, user_id=current_user.id, image_count=len(point_ids_to_update))
        db.add(new_group_sql)
        db.commit()
        db.refresh(new_group_sql)
        return UpdateGroupNameResponse(
            message=f"Successfully renamed group from '{old_name}' to '{new_name}'. A new SQL record was created due to inconsistency.",
            updated_group_name=new_name,
            image_count=new_group_sql.image_count
        )

    # Kiểm tra xem nhóm với tên mới đã tồn tại chưa
    target_group_sql = db.query(FaceGroup).filter_by(name=new_name, user_id=current_user.id).first()

    if target_group_sql:
        # Trường hợp MERGE: Nhóm mới đã tồn tại, hợp nhất nhóm cũ vào
        target_group_sql.image_count += old_group_sql.image_count
        db.delete(old_group_sql)
        final_image_count = target_group_sql.image_count
    else:
        # Trường hợp RENAME: Nhóm mới chưa tồn tại, chỉ cần đổi tên nhóm cũ
        old_group_sql.name = new_name
        final_image_count = old_group_sql.image_count

    db.commit()

    return UpdateGroupNameResponse(
        message=f"Successfully renamed group from '{old_name}' to '{new_name}'.",
        updated_group_name=new_name,
        image_count=final_image_count
    )

@router.put("/replace/{point_id}", response_model=FaceRecord, tags=["images"])
async def replace_face_image(
    point_id: str = Path(..., description="ID của điểm vector cần thay thế ảnh."),
    file: UploadFile = File(..., description="Ảnh mới để thay thế."),
    current_user: User = Depends(get_current_active_user),
):
    """
    Thay thế ảnh và vector embedding của một bản ghi khuôn mặt đã có.
    - Tải ảnh mới lên R2.
    - Tạo embedding mới.
    - Cập nhật bản ghi trong Qdrant.
    - Xóa ảnh cũ khỏi R2.
    """
    qdrant_client = get_qdrant_client()

    # 1. Truy xuất và xác thực bản ghi hiện có
    points = qdrant_client.retrieve(collection_name=IMAGE_COLLECTION_NAME, ids=[point_id], with_payload=True)
    if not points:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Face record not found")

    point = points[0]
    if point.payload.get("user_id") != current_user.username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this record")

    # Lưu lại URL ảnh cũ để xóa sau
    old_image_url = point.payload.get("image_url")

    # 2. Xử lý file ảnh mới
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Must be an image.")

    try:
        image_bytes = await file.read()
        image_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        np_image = np.array(image_pil)
        np_bgr_img = cv2.cvtColor(np_image, cv2.COLOR_RGB2BGR)

        # Tạo embedding mới từ khuôn mặt lớn nhất trong ảnh
        new_embedding, _ = generate_embedding_for_largest_face(np_bgr_img, detector, recognizer)
        if new_embedding is None:
            raise HTTPException(status_code=400, detail="No face could be detected in the new image.")

        # 3. Tải ảnh mới lên R2
        new_image_url = await upload_img_to_r2(image_pil)

        # 4. Cập nhật (Upsert) bản ghi trong Qdrant
        # Upsert sẽ ghi đè lên điểm đã có nếu `id` trùng khớp.
        updated_payload = point.payload.copy()
        updated_payload["image_url"] = new_image_url

        qdrant_client.upsert(
            collection_name=IMAGE_COLLECTION_NAME,
            points=[
                qdrant_models.PointStruct(
                    id=point.id,
                    vector=new_embedding.tolist(),
                    payload=updated_payload
                )
            ],
            wait=True
        )

        # 5. Xóa ảnh cũ khỏi R2
        if old_image_url:
            await delete_img_from_r2(old_image_url)

        # 6. Trả về bản ghi đã được cập nhật
        return FaceRecord(id=point.id, **updated_payload)

    except Exception as e:
        # Ghi lại lỗi chi tiết hơn ở server
        print(f"An error occurred during image replacement: {e}")
        # Trả về lỗi chung cho client
        raise HTTPException(status_code=500, detail=f"An error occurred during image replacement.")

@router.post("/search-face", response_model=List[SearchResult])
async def search_faces(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """Tìm kiếm khuôn mặt tương tự trong bộ sưu tập của người dùng."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type")

    try:

        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        np_image = np.array(image)

        np_bgr_img = cv2.cvtColor(np_image, cv2.COLOR_RGB2BGR)

        embedding_vector, _ = generate_embedding_for_largest_face(np_bgr_img, detector, recognizer)

        if embedding_vector is None:
            raise HTTPException(status_code=400, detail="No face detected in the uploaded image.")
        qdrant_client = get_qdrant_client()
        user_filter = qdrant_models.Filter(
            must=[
                qdrant_models.FieldCondition(
                    key="user_id",
                    match=qdrant_models.MatchValue(value=current_user.username)
                )
            ]
        )

        hits = qdrant_client.query_points(
            collection_name=IMAGE_COLLECTION_NAME,
            query=embedding_vector.tolist(),
            query_filter=user_filter,
            limit=5
        )

        return [
            SearchResult(id=hit.id, score=hit.score, **hit.payload) for hit in hits
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during search: {e}")
