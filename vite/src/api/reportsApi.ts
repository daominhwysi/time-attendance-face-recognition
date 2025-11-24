import { apiClient } from './api'

export interface AttendanceRow {
  name: string
  first_seen: string | null
  last_seen: string | null
  total_duration_minutes: number | null
  status: string
}

export const getCustomAttendanceReport = async (start: Date, end: Date) => {
  const params = {
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  }
  const response = await apiClient.get<AttendanceRow[]>(
    '/reports/attendance/custom',
    { params }
  )
  return response.data
}
