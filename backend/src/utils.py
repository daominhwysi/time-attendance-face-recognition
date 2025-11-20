import asyncio
import io
import os
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse
import uuid

import numpy as np
import aioboto3
from dotenv import load_dotenv

from lib.uniface.detection.srcfd import SCRFD
from lib.uniface.recogition.models import ArcFace

load_dotenv()

# Required ENV variables
ENDPOINT_URL_R2 = os.getenv("ENDPOINT_URL_R2")
AWS_ACCESS_KEY_ID_R2 = os.getenv("AWS_ACCESS_KEY_ID_R2")
AWS_SECRET_ACCESS_KEY_R2 = os.getenv("AWS_SECRET_ACCESS_KEY_R2")
PUBLIC_URL_R2 = os.getenv("PUBLIC_URL_R2")

if not all([ENDPOINT_URL_R2, AWS_ACCESS_KEY_ID_R2, AWS_SECRET_ACCESS_KEY_R2, PUBLIC_URL_R2]):
    raise RuntimeError("Missing required environment variables for R2")

# Parse bucket and endpoint
parsed = urlparse(ENDPOINT_URL_R2)
bucket_name = parsed.path.lstrip("/")
endpoint_base = f"{parsed.scheme}://{parsed.netloc}"

# FNV-1a hash (simple 32-bit)


# Upload single image
async def upload_img_to_r2(img) -> str:
    """
    img: PIL.Image
    """
    output = io.BytesIO()
    img.convert("RGB").save(output, format="JPEG", quality=95, optimize=True)
    jpeg_bytes = output.getvalue()

    key = f"{uuid.uuid4()}.jpg"

    session = aioboto3.Session()
    async with session.client(
        "s3",
        endpoint_url=endpoint_base,
        aws_access_key_id=AWS_ACCESS_KEY_ID_R2,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY_R2,
        region_name="auto",
    ) as s3:
        await s3.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=jpeg_bytes,
            ContentType="image/jpeg",
            ACL="public-read"
        )

    return f"{PUBLIC_URL_R2}/{key}"


# Upload multiple images with concurrency limit
async def upload_multiple_images(images: List, concurrency_limit: int = 10) -> List[str]:

    sem = asyncio.Semaphore(concurrency_limit)

    async def limited_upload(images: bytes):
        async with sem:
            return await upload_img_to_r2(images)

    tasks = [limited_upload(img) for img in images]
    return await asyncio.gather(*tasks)

async def upload_cropped_object_r2(data):
    images_list = [img for img in data.values()]
    images_urls = await upload_multiple_images(images_list)
    refined_data = {k: url for k, url in zip(data.keys(), images_urls)}
    return refined_data


def generate_embedding_for_largest_face(
    image: np.ndarray,
    detector: SCRFD,
    recognizer: ArcFace,
    min_face_size: int = 50
) -> Tuple[Optional[np.ndarray], Optional[Dict[str, Any]]]:
    faces = detector.detect(image)
    if not faces:
        return None, None
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
        print(f"Đã xảy ra lỗi khi tạo embedding: {e}")
        return None, None


async def delete_img_from_r2(image_url: str):
    """
    Xóa một đối tượng khỏi R2 bucket dựa trên URL công khai của nó.
    """
    if not image_url:
        return

    try:
        # Trích xuất key (tên file) từ URL
        parsed_url = urlparse(image_url)
        key = parsed_url.path.lstrip("/")
        if not key:
            print(f"Warning: Could not extract key from URL: {image_url}")
            return

        session = aioboto3.Session()
        async with session.client(
            "s3",
            endpoint_url=endpoint_base,
            aws_access_key_id=AWS_ACCESS_KEY_ID_R2,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY_R2,
            region_name="auto",
        ) as s3:
            print(f"Attempting to delete {key} from bucket {bucket_name}")
            await s3.delete_object(Bucket=bucket_name, Key=key)
            print(f"Successfully deleted {key} from R2.")

    except Exception as e:
        # Ghi lại lỗi nhưng không làm sập ứng dụng.
        # Việc không xóa được ảnh cũ không phải là một lỗi nghiêm trọng.
        print(f"Error deleting image {image_url} from R2: {e}")
