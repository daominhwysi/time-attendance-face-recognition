import asyncio
import base64
import io
import cv2
import numpy as np
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from PIL import Image
from sqlalchemy.orm import Session

from src.auth import get_current_user_ws
from src.models import User, FaceGroup
from src.faces import detector, recognizer
from src.qdrant_client import get_qdrant_client, IMAGE_COLLECTION_NAME
from qdrant_client import models as qdrant_models
from src.database import SessionLocal

router = APIRouter(
    prefix="/stream",
    tags=["streaming"],
)

# In-memory cache to throttle DB updates: { "label_userid": timestamp }
last_seen_cache = {}
DB_UPDATE_INTERVAL_SECONDS = 60

class FrameManager:
    """Manages the latest frame to be processed, preventing a backlog."""
    def __init__(self):
        self.latest_frame = None
        self.lock = asyncio.Lock()

    async def set_frame(self, frame_bytes: bytes):
        async with self.lock:
            self.latest_frame = frame_bytes

    async def get_frame(self) -> bytes | None:
        async with self.lock:
            frame = self.latest_frame
            self.latest_frame = None
            return frame

def decode_and_preprocess_image(frame_bytes):
    """CPU-bound helper for decoding image."""
    try:
        image_data = base64.b64decode(frame_bytes.split(",")[1])
        image_pil = Image.open(io.BytesIO(image_data)).convert("RGB")
        np_image = np.array(image_pil)
        return cv2.cvtColor(np_image, cv2.COLOR_RGB2BGR)
    except Exception:
        return None

async def recognition_task(
    websocket: WebSocket, frame_manager: FrameManager, current_user: User
):
    """
    Runs in the background, offloading CPU tasks to threads.
    """
    qdrant_client = get_qdrant_client()

    while True:
        frame_bytes = await frame_manager.get_frame()
        if not frame_bytes:
            # Yield control to event loop if no frame is ready
            await asyncio.sleep(0.01)
            continue
        if frame_bytes:
            try:
                # 1. Offload Image Decoding (CPU Bound)
                np_bgr_img = await asyncio.to_thread(decode_and_preprocess_image, frame_bytes)

                if np_bgr_img is not None:
                    # 2. Offload Face Detection (CPU Bound)
                    faces = await asyncio.to_thread(detector.detect, np_bgr_img)

                    results_to_send = []

                    if faces:
                        # Create DB session only when needed
                        db: Session = SessionLocal()
                        try:
                            for face in faces:
                                landmarks = np.array(face["landmarks"])

                                # 3. Offload Recognition/Embedding (CPU Bound)
                                embedding = await asyncio.to_thread(
                                    recognizer.get_normalized_embedding,
                                    np_bgr_img,
                                    landmarks
                                )

                                user_filter = qdrant_models.Filter(
                                    must=[
                                        qdrant_models.FieldCondition(
                                            key="user_id",
                                            match=qdrant_models.MatchValue(value=current_user.username),
                                        )
                                    ]
                                )

                                # 4. Offload Vector Search (IO/Network Bound - Sync Client)
                                hits = await qdrant_client.query_points(
                                    collection_name=IMAGE_COLLECTION_NAME,
                                    query=embedding[0].tolist(),
                                    query_filter=user_filter,
                                    limit=1,
                                    score_threshold=0.4,
                                )

                                box = list(map(int, face["bbox"]))

                                if hits.points:
                                    best_match = hits.points[0]
                                    label = best_match.payload["name"]
                                    results_to_send.append({
                                        "box": box,
                                        "label": label,
                                        "score": best_match.score,
                                    })

                                    # --- THROTTLING LOGIC ---
                                    # Prevent DB locking by only updating last_seen every 60s
                                    cache_key = f"{current_user.id}_{label}"
                                    now = datetime.now(timezone.utc)
                                    last_update = last_seen_cache.get(cache_key)

                                    if not last_update or (now - last_update) > timedelta(seconds=DB_UPDATE_INTERVAL_SECONDS):
                                        group = db.query(FaceGroup).filter_by(name=label, user_id=current_user.id).first()
                                        if group:
                                            group.last_seen_at = now
                                            db.commit()
                                            last_seen_cache[cache_key] = now
                                            # print(f"Updated last_seen for {label}")
                                    # ------------------------
                                else:
                                    results_to_send.append({
                                        "box": box,
                                        "label": "Unknown",
                                        "score": 0.0
                                    })

                        except Exception as e:
                            print(f"Error in DB/Processing loop: {e}")
                            db.rollback()
                        finally:
                            db.close()

                    if results_to_send:
                        await websocket.send_json({"results": results_to_send})

            except Exception as e:
                print(f"Error processing frame wrapper: {e}")

        # Yield control back to event loop
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
            # Receive frame from client
            frame_data = await websocket.receive_text()
            await frame_manager.set_frame(frame_data)
    except WebSocketDisconnect:
        print(f"Client {current_user.username} disconnected.")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        processing_task.cancel()
        print(f"Recognition task for {current_user.username} cancelled.")
