import { apiClient } from './api'

export interface SightingRecord {
  name: string
  last_seen_at: string | null
}

export const getSightings = async (filters: {
  seen_after?: string
  not_seen_since?: string
}): Promise<SightingRecord[]> => {
  const response = await apiClient.get<SightingRecord[]>('/reports/sightings', {
    params: filters,
  })
  return response.data
}
