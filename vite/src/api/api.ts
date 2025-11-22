import axios, { AxiosError } from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_BASE_API_URL,
})

// --- Add Bearer Token Interceptor ---
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export interface UserCreate {
  username: string
  password: string
}

export interface UserOut {
  id: number
  username: string
}

export interface Token {
  access_token: string
  token_type: string
}

// --- API Calls ---

export const register = (credentials: UserCreate) =>
  apiClient.post<UserOut>('/register', credentials)

export const login = (credentials: UserCreate) => {
  // FastAPI OAuth2PasswordRequestForm expects form-data
  const formData = new FormData()
  formData.append('username', credentials.username)
  formData.append('password', credentials.password)

  return apiClient.post<Token>('/login', formData)
}

export const me = () => apiClient.get<UserOut>('/me')

export const logout = () => {
  // Clear token immediately on client
  localStorage.removeItem('access_token')
  return apiClient.post('/logout')
}

// --- Error Handling Interceptor ---
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // If 401, token is invalid/expired. Clear storage and event logout.
      localStorage.removeItem('access_token')
      window.dispatchEvent(new Event('logout'))
    }
    return Promise.reject(error)
  }
)

export interface DashboardStats {
  total_identities: number
  total_images: number
  recent_sightings: number
}

// ... existing functions ...

// Add this new function
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await apiClient.get<DashboardStats>('/images/stats')
  return response.data
}
