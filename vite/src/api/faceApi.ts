import { apiClient } from './api'
import type { FaceRecord, GroupedFace, SearchResult } from '@/types'

// --- Interfaces ---
export interface PaginatedGroupResponse {
  items: GroupedFace[]
  total_groups: number
  page: number
  page_size: number
}

// --- Actions ---

export const listMyFacesGrouped = async (
  page: number = 1,
  pageSize: number = 10
) => {
  const params = { page, page_size: pageSize }
  const response = await apiClient.get<PaginatedGroupResponse>(
    '/images/my-faces/grouped',
    { params }
  )
  return response.data
}

export const searchFaces = async (imageFile: File) => {
  const formData = new FormData()
  formData.append('file', imageFile)
  const response = await apiClient.post<SearchResult[]>(
    '/images/search-face',
    formData
  )
  return response.data
}

export const renameFaceGroup = async (pointId: string, newName: string) => {
  const response = await apiClient.put(`/images/rename-group/${pointId}`, {
    name: newName,
  })
  return response.data
}

export const deleteFace = async (pointId: string) => {
  await apiClient.delete(`/images/${pointId}`)
}

export const deleteFaceGroup = async (groupId: number) => {
  await apiClient.delete(`/images/groups/${groupId}`)
}

export const replaceFaceImage = async (pointId: string, imageFile: File) => {
  const formData = new FormData()
  formData.append('file', imageFile)
  const response = await apiClient.put<FaceRecord>(
    `/images/replace/${pointId}`,
    formData
  )
  return response.data
}

export interface UploadResult {
  point_id: string
  filename: string
  label: string
}

export interface MultiUploadResponse {
  message: string
  successful_uploads: UploadResult[]
  failed_uploads: string[]
}

export const uploadFaces = async (files: File[], labels: string[]) => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  labels.forEach((label) => formData.append('labels', label))

  const response = await apiClient.post<MultiUploadResponse>(
    '/images/upload-faces',
    formData
  )
  return response.data
}
