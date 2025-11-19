import os
from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from src import faces, reports, streaming

from . import models
from .auth import (
    create_access_token,
    create_refresh_token,  # Import refresh token creator
    get_current_active_user,
    hash_password,
    verify_password,
    verify_token,  # Import token verifier
)

# --- Imports have been updated ---
from .database import engine, get_db
from .qdrant_client import setup_qdrant
from .schemas import UserCreate, UserOut

# --- End of updated imports ---
from dotenv import load_dotenv
load_dotenv()
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.on_event("startup")
def on_startup():
    setup_qdrant()

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

@app.post("/login")
def login(user: UserCreate, response: Response, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()

    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Create both access and refresh tokens
    access_token = create_access_token({"sub": user.username})
    refresh_token = create_refresh_token({"sub": user.username})

    # Set both tokens in HttpOnly cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
    )
    return {"msg": "Login successful"}

@app.post("/refresh-token")
def refresh_access_token(
    response: Response,
    refresh_token: str = Cookie(None),
    db: Session = Depends(get_db)
):
    """
    Validates the refresh token and issues a new access token.
    """
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token not found")
    try:
        username = verify_token(refresh_token)
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user:
            raise HTTPException(status_code=401, detail="User from token not found")

        new_access_token = create_access_token(data={"sub": username})
        response.set_cookie(key="access_token", value=new_access_token, httponly=True)
        return {"ok": True}
    except HTTPException as e:
        # If verify_token fails (e.g., expired), re-raise its specific error
        raise e


@app.get("/me", response_model=UserOut)
def get_current_user(current_user: models.User = Depends(get_current_active_user)):
    return current_user

@app.post("/logout")
def logout(response: Response):
    # Clear both cookies on logout
    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token")
    return {"msg": "Successfully logged out"}
