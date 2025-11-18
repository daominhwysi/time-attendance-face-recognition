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
      setIsLoading(true)
      try {
        const response = await api.me()
        setUser(response.data)
      } catch (error) {
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    checkLoggedIn()
  }, [])

  const login = async (credentials: api.UserCreate) => {
    try {
      await api.login(credentials)
      const response = await api.me()
      setUser(response.data)
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
      setUser(null)
      navigate('/login')
    }
  }

  // Listen for the global 'logout' event dispatched by the API interceptor
  useEffect(() => {
    const handleForcedLogout = () => {
      console.log('Forced logout due to token refresh failure.')
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
    [user, isLoading] // Dependencies are correct
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
