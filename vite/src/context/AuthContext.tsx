import {
  createContext,
  useState,
  useContext,
  useEffect,
  type ReactNode,
  useMemo,
} from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api/api'

interface User {
  id: number
  username: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (credentials: api.UserCreate) => Promise<void>
  register: (credentials: api.UserCreate) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const checkLoggedIn = async () => {
      const token = localStorage.getItem('access_token')
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const response = await api.me()
        setUser(response.data)
      } catch (error) {
        // Token invalid
        localStorage.removeItem('access_token')
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    checkLoggedIn()
  }, [])

  const login = async (credentials: api.UserCreate) => {
    try {
      const response = await api.login(credentials)
      // Save the Bearer token
      localStorage.setItem('access_token', response.data.access_token)

      // Fetch user details immediately
      const userResponse = await api.me()
      setUser(userResponse.data)

      navigate('/')
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const register = async (credentials: api.UserCreate) => {
    try {
      await api.register(credentials)
      await login(credentials)
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      await api.logout()
    } catch (error) {
      console.error('Logout failed but clearing session locally:', error)
    } finally {
      localStorage.removeItem('access_token')
      setUser(null)
      navigate('/login')
    }
  }

  // Listen for the global 'logout' event from api interceptor
  useEffect(() => {
    const handleForcedLogout = () => {
      setUser(null)
      navigate('/login', { replace: true })
    }

    window.addEventListener('logout', handleForcedLogout)
    return () => {
      window.removeEventListener('logout', handleForcedLogout)
    }
  }, [navigate])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading]
  )

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
