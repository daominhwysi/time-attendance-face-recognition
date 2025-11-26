import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  LayoutDashboard,
  Users,
  FileText,
  LogOut,
  Menu,
  X,
  UserCircle,
  Camera,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
// import { Separator } from '@/components/ui/separator'

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Manage Faces', href: '/manage-faces', icon: Users },
    { name: 'Live Monitor', href: '/stream', icon: Camera },
    { name: 'Reports', href: '/report', icon: FileText },
  ]

  return (
    <div className="bg-muted/40 flex min-h-screen">
      {/* Sidebar - Desktop */}
      <aside className="bg-background hidden w-64 flex-col border-r md:flex">
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="grid gap-1 px-3">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-1.5 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-muted shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.5} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="border-t p-4">
          <div className="bg-muted/50 flex items-center gap-3 rounded-lg px-3 py-3">
            <div className="bg-background flex h-9 w-9 items-center justify-center rounded-full border">
              <UserCircle className="text-muted-foreground h-5 w-5" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user?.username}</p>
              <p className="text-muted-foreground truncate text-xs">Admin</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Logout"
              className="text-muted-foreground hover:text-destructive h-8 w-8"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="bg-background flex h-16 items-center justify-between border-b px-6 md:hidden">
          <div className="flex items-center gap-2 text-lg font-bold">
            Lorem Ipsum
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="bg-background/95 animate-in fade-in slide-in-from-bottom-10 absolute inset-0 z-50 flex flex-col p-4 backdrop-blur-sm md:hidden">
            <div className="mb-4 flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors',
                    location.pathname === item.href
                      ? 'bg-muted shadow-sm'
                      : 'hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="mt-auto border-t pt-4">
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={logout}
              >
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="bg-muted/20 flex-1 overflow-y-auto p-4 md:p-8">
          <div className="animate-in fade-in mx-auto max-w-6xl space-y-6 duration-500">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
