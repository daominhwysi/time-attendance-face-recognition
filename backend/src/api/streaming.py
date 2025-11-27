import asyncio
import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from src.core.ml_models import ml_models
from src.db.session import get_db
from src.db.qdrant import get_qdrant_client, IMAGE_COLLECTION_NAME
from src.db.models import User
from src.core.security import get_current_user_ws
from qdrant_client import models as qdrant_models
from src.services.sighting_worker import sighting_worker

router = APIRouter(prefix="/stream", tags=["streaming"])

# --- Logic Helper ---
# Changed input type from str to bytes
async def process_frame(frame_bytes: bytes, current_user: User, db: Session):
    try:
        # 1. Decode directly from bytes (No Base64 step needed)
        # Convert raw bytes to numpy array
        nparr = np.frombuffer(frame_bytes, np.uint8)
        # Decode image
        np_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if np_img is None:
            return []
    except Exception:
        return []

    # 2. Detect Faces
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

    state = {
        "latest_frame": None, # Will now hold bytes
        "is_active": True,
        "evt": asyncio.Event(),
    }

    # --- TASK 1: READER ---
    async def receive_loop():
        try:
            while state["is_active"]:
                # CHANGED: receive_bytes instead of receive_text
                data = await websocket.receive_bytes()

                state["latest_frame"] = data
                state["evt"].set()
        except (WebSocketDisconnect, Exception):
            state["is_active"] = False
            state["evt"].set()

    # --- TASK 2: PROCESSOR ---
    async def process_loop():
        while state["is_active"]:
            await state["evt"].wait()
            state["evt"].clear()

            frame_data = state["latest_frame"]

            if not frame_data or not state["is_active"]:
                break

            try:
                # frame_data is now bytes
                results = await process_frame(frame_data, current_user, db)

                if state["is_active"]:
                    await websocket.send_json({"results": results})
            except Exception as e:
                print(f"Error processing frame: {e}")

    try:
        reader_task = asyncio.create_task(receive_loop())
        processor_task = asyncio.create_task(process_loop())

        done, pending = await asyncio.wait(
            [reader_task, processor_task], return_when=asyncio.FIRST_COMPLETED
        )

        for task in pending:
            task.cancel()

    except Exception as e:
        print(f"WS Error: {e}")
    finally:
        print(f"Disconnected: {current_user.username}")
        db.close()
