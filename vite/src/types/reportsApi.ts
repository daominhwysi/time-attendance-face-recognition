import { apiClient } from '@/api/api'

export interface ReportWindow {
  id: number
  name: string
  start_time: string
  end_time: string
}

export interface AttendanceRow {
  name: string
  first_seen: string | null
  last_seen: string | null
  total_duration_minutes: number | null
  status: string
}

export const getSavedWindows = async () => {
  const response = await apiClient.get<ReportWindow[]>('/reports/windows')
  return response.data
}

export const createWindow = async (name: string, start: Date, end: Date) => {
  const response = await apiClient.post<ReportWindow>('/reports/windows', {
    name,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  })
  return response.data
}

export const deleteWindow = async (id: number) => {
  await apiClient.delete(`/reports/windows/${id}`)
}

export const getAttendanceReport = async (windowId: number) => {
  const response = await apiClient.get<AttendanceRow[]>(
    `/reports/attendance/${windowId}`
  )
  return response.data
}
