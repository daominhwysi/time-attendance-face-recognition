import asyncio
import base64
from datetime import datetime, timezone  # Import datetime and timezone
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from PIL import Image
import io
import cv2
import numpy as np
from sqlalchemy.orm import Session

# Import dependency xác thực WebSocket chính xác từ auth.py
from src.auth import get_current_user_ws
from src.models import User, FaceGroup # Import FaceGroup
from src.faces import detector, recognizer
from src.qdrant_client import get_qdrant_client, IMAGE_COLLECTION_NAME
from qdrant_client import models as qdrant_models
from src.database import SessionLocal # Import SessionLocal to create db sessions

router = APIRouter(
    prefix="/stream",
    tags=["streaming"],
)

# ... (FrameManager class remains the same) ...
class FrameManager:
    """Manages the latest frame to be processed, preventing a backlog."""

    def __init__(self):
        self.latest_frame = None
        self.lock = asyncio.Lock()

    async def set_frame(self, frame_bytes: bytes):
        """Sets the latest frame, overwriting any previous one."""
        async with self.lock:
            self.latest_frame = frame_bytes

    async def get_frame(self) -> bytes | None:
        """Gets the latest frame and consumes it (sets to None)."""
        async with self.lock:
            frame = self.latest_frame
            self.latest_frame = None
            return frame

# Tác vụ chạy ngầm để xử lý nhận dạng khuôn mặt
async def recognition_task(
    websocket: WebSocket, frame_manager: FrameManager, current_user: User
):
    """
    Runs in the background, continuously processing the latest frame available
    from the FrameManager.
    """
    qdrant_client = get_qdrant_client()
    while True:
        frame_bytes = await frame_manager.get_frame()
        if frame_bytes:
            try:
                # 1. Decode image from base64 string
                image_data = base64.b64decode(frame_bytes.split(",")[1])
                image_pil = Image.open(io.BytesIO(image_data)).convert("RGB")
                np_image = np.array(image_pil)
                np_bgr_img = cv2.cvtColor(np_image, cv2.COLOR_RGB2BGR)

                # 2. Detect all faces
                faces = detector.detect(np_bgr_img)
                results_to_send = []

                if faces:
                    db: Session = SessionLocal() # Create a new session for this task iteration
                    try:
                        for face in faces:
                            # ... (embedding and search logic is the same) ...
                            landmarks = np.array(face["landmarks"])
                            embedding = recognizer.get_normalized_embedding(
                                np_bgr_img, landmarks
                            )
                            user_filter = qdrant_models.Filter(
                                must=[
                                    qdrant_models.FieldCondition(
                                        key="user_id",
                                        match=qdrant_models.MatchValue(
                                            value=current_user.username
                                        ),
                                    )
                                ]
                            )
                            hits = qdrant_client.search(
                                collection_name=IMAGE_COLLECTION_NAME,
                                query_vector=embedding[0].tolist(),
                                query_filter=user_filter,
                                limit=1,
                                score_threshold=0.4,
                            )
                            box = list(map(int, face["bbox"]))
                            if hits:
                                best_match = hits[0]
                                label = best_match.payload["name"]
                                results_to_send.append(
                                    {
                                        "box": box,
                                        "label": label,
                                        "score": best_match.score,
                                    }
                                )
                                # --- START OF NEW LOGIC ---
                                # Update the last_seen_at timestamp
                                group = db.query(FaceGroup).filter_by(name=label, user_id=current_user.id).first()
                                if group:
                                    group.last_seen_at = datetime.now(timezone.utc)
                                # --- END OF NEW LOGIC ---
                            else:
                                results_to_send.append(
                                    {"box": box, "label": "Unknown", "score": 0.0}
                                )
                        db.commit() # Commit all timestamp updates at once
                    except Exception as e:
                        print(f"Error during face processing loop: {e}")
                        db.rollback() # Rollback on error
                    finally:
                        db.close() # Always close the session

                if results_to_send:
                    await websocket.send_json({"results": results_to_send})

            except Exception as e:
                print(f"Error processing frame: {e}")

        await asyncio.sleep(0.05)


# ... (websocket_endpoint function remains the same) ...
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    current_user: User = Depends(get_current_user_ws),
):
    await websocket.accept()
    print(f"WebSocket connection accepted for user: {current_user.username}")
    frame_manager = FrameManager()
    processing_task = asyncio.create_task(
        recognition_task(websocket, frame_manager, current_user)
    )
    try:
        while True:
            frame_data = await websocket.receive_text()
            await frame_manager.set_frame(frame_data)
    except WebSocketDisconnect:
        print(f"Client {current_user.username} disconnected.")
    finally:
        processing_task.cancel()
        print(f"Recognition task for {current_user.username} cancelled.")
