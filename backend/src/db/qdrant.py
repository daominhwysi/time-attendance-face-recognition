from qdrant_client import AsyncQdrantClient, models
from functools import lru_cache
from src.core.config import settings

IMAGE_COLLECTION_NAME = "face_collection"
VECTOR_SIZE = 512

@lru_cache(maxsize=1)
def get_qdrant_client() -> AsyncQdrantClient:
    print("Initializing Qdrant Client...")

    return AsyncQdrantClient(path='./local_qdrant_storage')

async def setup_qdrant():
    client = get_qdrant_client()
    if not await client.collection_exists(IMAGE_COLLECTION_NAME):
        await client.create_collection(
            collection_name=IMAGE_COLLECTION_NAME,
            vectors_config=models.VectorParams(size=VECTOR_SIZE, distance=models.Distance.COSINE),
        )
        # Create Payload Indexes
        await client.create_payload_index(IMAGE_COLLECTION_NAME, "user_id", models.PayloadSchemaType.KEYWORD)
        await client.create_payload_index(IMAGE_COLLECTION_NAME, "name", models.PayloadSchemaType.KEYWORD)
