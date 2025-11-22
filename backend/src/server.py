import os
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from src import faces, reports, streaming
from . import models
from .auth import (
    create_access_token,
    get_current_active_user,
    hash_password,
    verify_password,
)
from .database import engine, get_db
from .qdrant_client import setup_qdrant
# FIX: Import Token from schemas, not faces
from .schemas import UserCreate, UserOut, Token

load_dotenv()
models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await setup_qdrant()
    yield

app = FastAPI(lifespan=lifespan)

cors_origins = os.getenv("CORS_URL")
if cors_origins:
    allow_origins = cors_origins.split(",")
else:
    allow_origins = ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(faces.router)
app.include_router(streaming.router)
app.include_router(reports.router)

@app.get("/hello")
def read_root():
    return {"Hello": "World"}

@app.post("/register", response_model=UserOut)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already taken")
    hashed_pw = hash_password(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# FIX: Updated Login route to use OAuth2PasswordRequestForm and return Token schema
@app.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # OAuth2PasswordRequestForm puts username in form_data.username
    db_user = db.query(models.User).filter(models.User.username == form_data.username).first()

    if not db_user or not verify_password(form_data.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(data={"sub": db_user.username})

    # Returns JSON matching the Token schema
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me", response_model=UserOut)
def get_current_user(current_user: models.User = Depends(get_current_active_user)):
    return current_user

@app.post("/logout")
def logout():
    return {"msg": "Successfully logged out"}
