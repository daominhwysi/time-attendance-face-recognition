from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    class Config:
        from_attributes = True # Pydantic v2

class Token(BaseModel):
    access_token: str
    token_type: str
