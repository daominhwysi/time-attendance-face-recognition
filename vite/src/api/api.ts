import axios, { AxiosError } from 'axios'

export const apiClient = axios.create({
  baseURL: 'http://localhost:8000',
  withCredentials: true,
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

// New function to call the refresh endpoint
const refreshToken = () => apiClient.post('/refresh-token')

// Auth API calls
export const register = (credentials: UserCreate) =>
  apiClient.post<UserOut>('/register', credentials)

export const login = (credentials: UserCreate) =>
  apiClient.post<{ msg: string }>('/login', credentials)

export const me = () => apiClient.get<UserOut>('/me')

export const logout = () => apiClient.post('/logout')

// --- Axios Interceptor for Token Refresh ---
let isRefreshing = false
let failedQueue: {
  resolve: (value?: unknown) => void
  reject: (reason?: any) => void
}[] = []

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url === '/refresh-token') {
        window.dispatchEvent(new Event('logout'))
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => apiClient(originalRequest))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await refreshToken()
        processQueue(null)
        return apiClient(originalRequest)
      } catch (refreshError: any) {
        processQueue(refreshError)
        window.dispatchEvent(new Event('logout'))
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
