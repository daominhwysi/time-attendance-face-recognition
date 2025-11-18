giờ tôi đang cần viết báo cáo cho dự án của tôi
Phương pháp thử nghiệm là như sau
Tôi có một folder dataset lfw có cấu trúc giống ImageFolder
Tôi cũng có một hàm để trích xuất đặc trưng khuôn mặt
```py
def generate_embedding_for_largest_face(
    image: np.ndarray,
    detector: SCRFD,
    recognizer: ArcFace,
    min_face_size: int = 0
) -> Tuple[Optional[np.ndarray], Optional[Dict[str, Any]]]:
    """
    Detects faces, selects the largest one, and generates a face embedding.
    Falls back to embedding the whole image if no face is detected.

    Args:
        image: Input image (BGR format).
        detector: SCRFD face detector instance.
        recognizer: ArcFace face recognizer instance.
        min_face_size: Minimum allowed face size (pixels).

    Returns:
        Tuple of (embedding, face_info).
        If no face is found, embedding is computed from the full image and face_info is {}.
    """
    faces = detector.detect(image)

    # No faces found → fallback
    if not faces:
        embedding = recognizer.get_normalized_embedding(image=image, use_landmarks=False)
        return embedding, {}

    # Find the largest face
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

    # No valid face after filtering → fallback
    if largest_face is None:
        embedding = recognizer.get_normalized_embedding(image=image, use_landmarks=False)
        return embedding, {}

    try:
        if 'landmarks' in largest_face and largest_face['landmarks'] is not None:
            np_landmarks = np.array(largest_face['landmarks'], dtype=np.float32)
            embedding = recognizer.get_normalized_embedding(image=image, landmarks=np_landmarks)
        else:
            embedding = recognizer.get_normalized_embedding(image=image, use_landmarks=False)

        return embedding[0], largest_face

    except Exception as e:
        print(f"Đã xảy ra lỗi khi tạo embedding: {e}")
        # As a safety net, return embedding of the whole image
        fallback_embedding = recognizer.get_normalized_embedding(image=image, use_landmarks=False)
        return fallback_embedding, {}


from lib.uniface.face_utils import face_alignment
from lib.uniface.detection.srcfd import SCRFD
from lib.uniface.recogition.models import ArcFace

rec = ArcFace(model_path="w600k_mbf.onnx")
detector = SCRFD(model_path="scrfd_500m_kps.onnx")

```
Giờ nhiệm vụ của bạn là viết tiếp code để thực hiện việc đo đạc kết quả cho kiến trúc của tôi
Nhiệm vụ là sẽ chọn một số k
ví dụ k=40 thì sẽ chọn 40 folder ảnh
ta sẽ embedding hóa tất cả ảnh trong folder ảnh đó rồi lưu vào vector database trong qdrant
tiếp đến với lần lượt mỗi folder ảnh trong 40 cái
nếu số lượng ảnh trong folder = 1 thì ta sẽ truy vấn xem có cái nào vượt threshold không, nếu có thì tính  1 lần sai.
nếu số lượng ảnh trong folder lớn hơn 1 thì ta xem có ảnh nào lớn hơn threshold không (trừ ảnh dùng để truy vấn), nếu có thì tính là thêm 1 lần đúng.

Bạn sẽ chọn các k phù hợp để viết bản báo cáo
Tiêu chí chính:
Tar (%)
FAR (%)
các tiêu chí phụ:
- tốc độ trên mỗi ảnh
- tốc độ truy vấn
