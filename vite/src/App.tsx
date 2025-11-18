// src/App.tsx (Updated)

import { Link } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Button } from './components/ui/button'
import { UserCircle2, LogOut } from 'lucide-react'

function App() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-2xl space-y-6 text-center">
        {user ? (
          <>
            <UserCircle2 className="mx-auto h-20 w-20 text-gray-400" />
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Hello, {user.username}!</h1>
              <p className="text-muted-foreground">
                You are successfully logged in using an HttpOnly cookie.
              </p>
            </div>
            <div className="flex justify-center gap-4 pt-4">
              <Button asChild size="lg">
                <Link to="/manage-faces">Manage Faces</Link>
              </Button>
              <Button onClick={logout} variant="outline" size="lg">
                <LogOut className="mr-2 h-4 w-4" /> Log Out
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
              Welcome to FaceFinder
            </h1>
            <p className="text-muted-foreground text-xl">
              Please log in to manage your face collection or create an account
              to get started.
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <Button asChild size="lg">
                <Link to="/login">Go to Login</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link to="/signup">Go to Sign Up</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App
