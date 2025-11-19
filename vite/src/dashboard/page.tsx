import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, History, AlertCircle, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import * as faceApi from '@/api/faceApi'
import * as reportApi from '@/api/reportsApi'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    totalFaces: 0,
    recentSightings: 0,
  })

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Parallel fetch for stats
        const [faces, sightings] = await Promise.all([
            faceApi.listMyFacesGrouped(1, 1000), // Get rough count
            reportApi.getSightings({ seen_after: new Date(Date.now() - 86400000).toISOString() }) // Last 24h
        ])

        // Calculate total images from groups
        const totalImages = faces.items.reduce((acc, group) => acc + group.image_count, 0)

        setStats({
            totalFaces: totalImages,
            recentSightings: sightings.length
        })
      } catch (e) {
        console.error("Failed to load dashboard stats")
      }
    }
    loadStats()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.username}. Here is an overview of your system.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Faces</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFaces}</div>
            <p className="text-xs text-muted-foreground">Indexed faces in database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentSightings}</div>
            <p className="text-xs text-muted-foreground">Sightings in last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                <AlertCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">Active</div>
                <p className="text-xs text-muted-foreground">Recognition service online</p>
            </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
          <Card>
              <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                  <Button asChild variant="outline" className="justify-between">
                      <Link to="/manage-faces">
                         <span>Manage Face Database</span>
                         <ChevronRight className="h-4 w-4" />
                      </Link>
                  </Button>
                  <Button asChild variant="outline" className="justify-between">
                      <Link to="/stream">
                         <span>Go to Live Monitor</span>
                         <ChevronRight className="h-4 w-4" />
                      </Link>
                  </Button>
                  <Button asChild variant="outline" className="justify-between">
                      <Link to="/report">
                         <span>View Sightings Report</span>
                         <ChevronRight className="h-4 w-4" />
                      </Link>
                  </Button>
              </CardContent>
          </Card>
      </div>
    </div>
  )
}
