from qdrant_client import QdrantClient, models
import os
from functools import lru_cache # Import lru_cache

# Định nghĩa tên cho collection Qdrant của chúng ta
IMAGE_COLLECTION_NAME = "face_collection"
VECTOR_SIZE = 512

# Bỏ dòng này đi:
# qdrant_client = QdrantClient(path="./local_vector")

@lru_cache(maxsize=1) # Cache sẽ đảm bảo hàm này chỉ chạy 1 lần
def get_qdrant_client() -> QdrantClient:
    """
    Tạo và trả về một instance duy nhất của QdrantClient.
    Sử dụng lru_cache để đảm bảo singleton pattern.
    """
    print("Initializing Qdrant client...")
    os.makedirs("./local_vector", exist_ok=True)
    client = QdrantClient(path="./local_vector_db")
    return client

def setup_qdrant():
    """
    Đảm bảo collection Qdrant được tạo khi ứng dụng khởi động.
    """
    client = get_qdrant_client() # Lấy client thông qua hàm
    try:
        client.get_collection(collection_name=IMAGE_COLLECTION_NAME)
        print(f"Collection '{IMAGE_COLLECTION_NAME}' đã tồn tại.")
    except Exception:
        print(f"Đang tạo collection '{IMAGE_COLLECTION_NAME}'.")
        client.create_collection(
            collection_name=IMAGE_COLLECTION_NAME,
            vectors_config=models.VectorParams(size=VECTOR_SIZE, distance=models.Distance.COSINE),
        )
        print("Tạo collection thành công.")
