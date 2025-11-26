from typing import List, Optional
from pydantic import BaseModel, Field

class FaceRecord(BaseModel):
    id: str
    name: str
    image_url: str

class UploadResult(BaseModel):
    point_id: str
    filename: str
    label: str

class MultiUploadResponse(BaseModel):
    message: str
    successful_uploads: List[UploadResult]
    failed_uploads: List[str]

class SearchResult(FaceRecord):
    score: float

class GroupedFaceResponse(BaseModel):
    id: int
    name: str
    images: List[FaceRecord]
    image_count: int

class PaginatedGroupResponse(BaseModel):
    items: List[GroupedFaceResponse]
    total_groups: int
    page: int
    page_size: int

class UpdateGroupName(BaseModel):
    name: str

class UpdateGroupNameResponse(BaseModel):
    message: str
    updated_group_name: str
    image_count: int
