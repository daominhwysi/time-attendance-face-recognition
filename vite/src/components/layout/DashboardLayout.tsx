import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  LayoutDashboard,
  Users,
  Cctv,
  FileText,
  LogOut,
  Menu,
  X,
  UserCircle
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
    { name: 'Live Monitor', href: '/stream', icon: Cctv },
    { name: 'Reports', href: '/report', icon: FileText },
  ]

  return (
    <div className="min-h-screen bg-muted/40 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden w-64 flex-col border-r bg-background md:flex">

        <div className="flex-1 overflow-y-auto py-6">
          <nav className="grid gap-1 px-3">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-1.5 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "bg-muted shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.5}/>
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="border-t p-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-3">
             <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background border">
                <UserCircle className="h-5 w-5 text-muted-foreground"/>
             </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user?.username}</p>
              <p className="truncate text-xs text-muted-foreground">Admin</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Logout" className="h-8 w-8 text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between border-b bg-background px-6 md:hidden">
          <div className="flex items-center gap-2 font-bold text-lg">
             Lorem Ipsum
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm md:hidden p-4 flex flex-col animate-in fade-in slide-in-from-bottom-10">
             <div className="flex justify-end mb-4">
               <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
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
                    "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors",
                    location.pathname === item.href
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              ))}
              </div>
              <div className="mt-auto border-t pt-4">
                <Button variant="destructive" className="w-full justify-start" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
              </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/20">
          <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in duration-500">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
