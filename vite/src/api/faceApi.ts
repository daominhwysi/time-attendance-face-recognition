// src/api/facesApi.ts

import { apiClient } from './api'
export type GroupedFaces = Record<string, FaceRecord[]>

// Type definitions matching the backend Pydantic models
export interface FaceRecord {
  id: string
  name: string
  image_url: string
}

export interface SearchResult extends FaceRecord {
  score: number
}

// API functions

export const deleteFace = async (pointId: string): Promise<void> => {
  await apiClient.delete(`/images/${pointId}`)
}

export interface UpdateGroupNameResponse {
  message: string
  updated_group_name: string
  image_count: number
}

export const renameFaceGroup = async (
  pointId: string,
  newName: string
): Promise<UpdateGroupNameResponse> => {
  const response = await apiClient.put<UpdateGroupNameResponse>(
    `/images/rename-group/${pointId}`, // <-- Route mới
    { name: newName } // <-- Body mới
  )
  return response.data
}

export const searchFaces = async (imageFile: File): Promise<SearchResult[]> => {
  const formData = new FormData()
  formData.append('file', imageFile)

  const response = await apiClient.post<SearchResult[]>(
    '/images/search-face',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return response.data
}

export const uploadFaces = async (
  files: File[],
  labels: string[]
): Promise<any> => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  labels.forEach((label) => formData.append('labels', label))

  const response = await apiClient.post('/images/upload-faces', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}
export interface PaginatedFaceResponse {
  items: FaceRecord[]
  next_cursor: string | null
}

export interface SearchResult extends FaceRecord {
  score: number
}

// 2. Update the list function to accept pagination params
export const listMyFaces = async (
  limit: number = 5,
  cursor: string | null = null
): Promise<PaginatedFaceResponse> => {
  const params: any = { limit }
  if (cursor) {
    params.cursor = cursor
  }

  const response = await apiClient.get<PaginatedFaceResponse>(
    '/images/my-faces',
    { params }
  )
  return response.data
}
export interface PaginatedGroupResponse {
  items: GroupedFace[]
  total_groups: number
  page: number
  page_size: number
}

export const listMyFacesGrouped = async (
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedGroupResponse> => {
  const params = {
    page: page,
    page_size: pageSize,
  }
  const response = await apiClient.get<PaginatedGroupResponse>(
    '/images/my-faces/grouped',
    { params }
  )
  return response.data
}

export interface GroupedFace {
  name: string
  images: FaceRecord[]
  image_count: number
}

export const replaceFaceImage = async (
  pointId: string,
  imageFile: File
): Promise<FaceRecord> => {
  const formData = new FormData()
  formData.append('file', imageFile)

  const response = await apiClient.put<FaceRecord>(
    `/images/replace/${pointId}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return response.data
}
