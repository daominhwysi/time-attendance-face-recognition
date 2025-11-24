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
from src.db.models import User, FaceGroup
from src.core.security import get_current_user_ws
from qdrant_client import models as qdrant_models
from src.services.sighting_worker import sighting_worker

router = APIRouter(prefix="/stream", tags=["streaming"])

# Logic Helper
async def process_frame(frame_bytes: bytes, current_user: User, db: Session):
    # 1. Decode
    try:
        image_data = base64.b64decode(frame_bytes.split(",")[1])
        pil_img = Image.open(io.BytesIO(image_data)).convert("RGB")
        np_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR) # type: ignore
    except Exception:
        return None

    # Face Detection
    # We use asyncio.to_thread because detection is CPU blocking
    faces = await asyncio.to_thread(ml_models.detector.detect, np_img)

    if not faces:
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
                must=[qdrant_models.FieldCondition(key="user_id", match=qdrant_models.MatchValue(value=current_user.username))]
            ),
            limit=1,
            score_threshold=0.4
        )

        label = "Unknown"
        score = 0.0

        if hits.points:
            best = hits.points[0]
            label = best.payload["name"]
            score = best.score

            if score > 0.4:
                await sighting_worker.push_sighting(current_user.id, label)


        results.append({
            "box": list(map(int, face["bbox"])),
            "label": label,
            "score": score
        })

    return results


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, current_user: User = Depends(get_current_user_ws)):
    await websocket.accept()
    # Create a dedicated DB session for this socket connection
    db = next(get_db())

    try:
        while True:
            data = await websocket.receive_text()
            # Run processing
            results = await process_frame(data, current_user, db)
            if results:
                await websocket.send_json({"results": results})
    except WebSocketDisconnect:
        print(f"Disconnected: {current_user.username}")
    finally:
        db.close()
