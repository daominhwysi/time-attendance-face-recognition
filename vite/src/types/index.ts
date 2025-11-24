export interface User {
  id: number
  username: string
}

export interface FaceRecord {
  id: string
  name: string
  image_url: string
}

export interface GroupedFace {
  id: number
  name: string
  images: FaceRecord[]
  image_count: number
}

export interface DashboardStats {
  total_identities: number
  total_images: number
  recent_sightings: number
}

export interface SearchResult extends FaceRecord {
  score: number
}
