from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from src.core.ml_models import ml_models
from src.db.session import engine, Base
from src.db.qdrant import setup_qdrant
from src.services.sighting_worker import sighting_worker
# Import Routes
from src.api import auth, images, streaming, reports

# Create Tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Load heavy AI models ONCE
    ml_models.load_models()
    await sighting_worker.start()
    await setup_qdrant()
    yield

app = FastAPI(lifespan=lifespan)

# CORS
origins = settings.CORS_URL.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth.router)
app.include_router(images.router)
app.include_router(streaming.router)
app.include_router(reports.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
