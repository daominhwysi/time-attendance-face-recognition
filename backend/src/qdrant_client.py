# backend/src/qdrant_client.py

from qdrant_client import AsyncQdrantClient, models
import os
from functools import lru_cache
from dotenv import load_dotenv
load_dotenv()

IMAGE_COLLECTION_NAME = "face_collection"
VECTOR_SIZE = 512

@lru_cache(maxsize=1)
def get_qdrant_client() -> AsyncQdrantClient:
    print("Initializing Qdrant Cloud client...")
    url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY")

    if not url:
        print("WARNING: Using local Qdrant memory storage.")
        return AsyncQdrantClient(":memory:")

    return AsyncQdrantClient(url=url, api_key=api_key)

async def setup_qdrant():
    client = get_qdrant_client()

    # 1. Create Collection if it doesn't exist
    try:
        await client.get_collection(collection_name=IMAGE_COLLECTION_NAME)
        print(f"Collection '{IMAGE_COLLECTION_NAME}' exists.")
    except Exception:
        print(f"Creating collection '{IMAGE_COLLECTION_NAME}'.")
        await client.create_collection(
            collection_name=IMAGE_COLLECTION_NAME,
            vectors_config=models.VectorParams(size=VECTOR_SIZE, distance=models.Distance.COSINE),
        )

    # 2. FIX: Create Payload Indexes (Idempotent - checks if exists internally usually, or we catch error)
    # We need indexes on 'user_id' and 'name' for filtering to work
    try:
        await client.create_payload_index(
            collection_name=IMAGE_COLLECTION_NAME,
            field_name="user_id",
            field_schema=models.PayloadSchemaType.KEYWORD,
        )
        print("Created index for 'user_id'")
    except Exception as e:
        print(f"Index for 'user_id' might already exist: {e}")

    try:
        await client.create_payload_index(
            collection_name=IMAGE_COLLECTION_NAME,
            field_name="name",
            field_schema=models.PayloadSchemaType.KEYWORD,
        )
        print("Created index for 'name'")
    except Exception as e:
        print(f"Index for 'name' might already exist: {e}")
