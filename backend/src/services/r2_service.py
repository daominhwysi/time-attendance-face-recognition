import io
import uuid
import aioboto3
from PIL import Image
from src.core.config import settings
from urllib.parse import urlparse

# Parse endpoint logic
parsed = urlparse(settings.ENDPOINT_URL_R2)
BUCKET_NAME = parsed.path.lstrip("/")
ENDPOINT_BASE = f"{parsed.scheme}://{parsed.netloc}"

async def upload_img_to_r2(img: Image.Image) -> str:
    output = io.BytesIO()
    img.convert("RGB").save(output, format="JPEG", quality=95, optimize=True)
    jpeg_bytes = output.getvalue()
    key = f"{uuid.uuid4()}.jpg"

    session = aioboto3.Session()
    async with session.client(
        "s3",
        endpoint_url=ENDPOINT_BASE,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID_R2,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY_R2,
        region_name="auto",
    ) as s3:
        await s3.put_object(
            Bucket=BUCKET_NAME,
            Key=key,
            Body=jpeg_bytes,
            ContentType="image/jpeg",
            ACL="public-read"
        )
    return f"{settings.PUBLIC_URL_R2}/{key}"

async def delete_img_from_r2(image_url: str):
    if not image_url: return
    try:
        key = urlparse(image_url).path.lstrip("/")
        session = aioboto3.Session()
        async with session.client(
            "s3",
            endpoint_url=ENDPOINT_BASE,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID_R2,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY_R2,
            region_name="auto",
        ) as s3:
            await s3.delete_object(Bucket=BUCKET_NAME, Key=key)
    except Exception as e:
        print(f"R2 Delete Error: {e}")
