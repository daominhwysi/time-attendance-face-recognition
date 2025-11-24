from lib.uniface.detection.srcfd import SCRFD
from lib.uniface.recogition.models import ArcFace

class AIModelManager:
    _instance = None

    def __init__(self):
        self.detector = None
        self.recognizer = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_models(self):
        print("Loading AI Models into Memory...")
        self.detector = SCRFD(model_path="models/scrfd_500m_kps.onnx")
        self.recognizer = ArcFace(model_path="models/w600k_mbf.onnx")
        print("AI Models Loaded.")

# Global instance
ml_models = AIModelManager.get_instance()
