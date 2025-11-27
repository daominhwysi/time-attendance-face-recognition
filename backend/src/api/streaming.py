import asyncio
import base64
import io
import cv2
import numpy as np
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from PIL import Image
from sqlalchemy.orm import Session

from src.core.ml_models import ml_models
from src.db.session import get_db
from src.db.qdrant import get_qdrant_client, IMAGE_COLLECTION_NAME
from src.db.models import User
from src.core.security import get_current_user_ws
from qdrant_client import models as qdrant_models
from src.services.sighting_worker import sighting_worker

router = APIRouter(prefix="/stream", tags=["streaming"])


# --- Logic Helper (Giữ nguyên logic xử lý ảnh) ---
async def process_frame(frame_bytes: str, current_user: User, db: Session):
    # 1. Decode
    try:
        # Cắt header "data:image/webp;base64," nếu có
        if "," in frame_bytes:
            frame_bytes = frame_bytes.split(",")[1]

        image_data = base64.b64decode(frame_bytes)
        # Dùng cv2.imdecode nhanh hơn PIL một chút trong trường hợp này
        nparr = np.frombuffer(image_data, np.uint8)
        np_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if np_img is None:
            return []
    except Exception:
        return []

    # 2. Face Detection
    # Quan trọng: asyncio.to_thread đẩy việc nặng sang Thread khác
    # giúp Event Loop không bị chặn, để hàm receive_loop bên dưới vẫn chạy được.
    faces = await asyncio.to_thread(ml_models.detector.detect, np_img)

    if not faces or len(faces) == 0:
        return []

    results = []
    qdrant = get_qdrant_client()

    for face in faces:
        # 3. Recognize
        landmarks = np.array(face["landmarks"])
        embedding = await asyncio.to_thread(
            ml_models.recognizer.get_normalized_embedding, np_img, landmarks
        )

        # 4. Search
        hits = await qdrant.query_points(
            collection_name=IMAGE_COLLECTION_NAME,
            query=embedding[0].tolist(),
            query_filter=qdrant_models.Filter(
                must=[
                    qdrant_models.FieldCondition(
                        key="user_id",
                        match=qdrant_models.MatchValue(value=current_user.username),
                    )
                ]
            ),
            limit=1,
            score_threshold=0.4,
        )

        label = "unknown"
        score = 0.0

        if hits.points:
            best = hits.points[0]
            label = best.payload["name"]
            score = best.score

            if score > 0.4:
                # Đẩy việc ghi DB sang worker background để không block luồng xử lý ảnh
                await sighting_worker.push_sighting(current_user.id, label)

        results.append(
            {"box": list(map(int, face["bbox"])), "label": label, "score": score}
        )

    return results


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, current_user: User = Depends(get_current_user_ws)
):
    await websocket.accept()
    db = next(get_db())

    # --- STATE MANAGEMENT ---
    # Biến shared state để lưu trữ frame mới nhất
    state = {
        "latest_frame": None,  # Chỉ lưu frame cuối cùng nhận được
        "is_active": True,  # Cờ kiểm soát vòng lặp
        "evt": asyncio.Event(),  # Cờ báo hiệu có dữ liệu mới
    }

    # --- TASK 1: READER (Tiêu thụ dữ liệu mạng cực nhanh) ---
    async def receive_loop():
        try:
            while state["is_active"]:
                # Hàm này block cho đến khi nhận được data từ client
                data = await websocket.receive_text()

                # UPDATE: Ghi đè frame cũ ngay lập tức
                state["latest_frame"] = data

                # Báo hiệu cho Processor
                state["evt"].set()
        except (WebSocketDisconnect, Exception):
            state["is_active"] = False
            state["evt"].set()  # Đánh thức processor để nó thoát vòng lặp

    # --- TASK 2: PROCESSOR (Chạy AI - tốn thời gian) ---
    async def process_loop():
        while state["is_active"]:
            # Chờ cho đến khi Reader báo hiệu có ảnh mới
            await state["evt"].wait()
            state["evt"].clear()

            # Lấy frame ra
            frame_data = state["latest_frame"]

            # Nếu Reader chết hoặc không có dữ liệu, skip
            if not frame_data or not state["is_active"]:
                break

            try:
                # Xử lý frame (Trong lúc hàm này chạy 100ms, Reader vẫn đang nhận frame mới và ghi đè)
                results = await process_frame(frame_data, current_user, db)

                # Chỉ gửi kết quả nếu kết nối còn sống
                if state["is_active"]:
                    await websocket.send_json({"results": results})
            except Exception as e:
                print(f"Error processing frame: {e}")
                # Không break ở đây để tránh crash luồng nếu 1 ảnh bị lỗi

    # --- MAIN EXECUTION ---
    try:
        # Chạy 2 task song song
        reader_task = asyncio.create_task(receive_loop())
        processor_task = asyncio.create_task(process_loop())

        # Chờ 1 trong 2 task kết thúc (thường là Reader kết thúc do client disconnect)
        done, pending = await asyncio.wait(
            [reader_task, processor_task], return_when=asyncio.FIRST_COMPLETED
        )

        # Dọn dẹp task còn lại
        for task in pending:
            task.cancel()

    except Exception as e:
        print(f"WS Error: {e}")
    finally:
        print(f"Disconnected: {current_user.username}")
        db.close()
