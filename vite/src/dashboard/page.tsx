import { useEffect, useState } from 'react'
import { Users, History, Activity  } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// import { useAuth } from '@/context/AuthContext'
import * as faceApi from '@/api/faceApi'
import * as reportApi from '@/api/reportsApi'

export default function DashboardPage() {
  // const { user } = useAuth()
  const [stats, setStats] = useState({
    totalFaces: 0,
    recentSightings: 0,
  })

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [faces, sightings] = await Promise.all([
            faceApi.listMyFacesGrouped(1, 1000),
            reportApi.getSightings({ seen_after: new Date(Date.now() - 86400000).toISOString() })
        ])
        const totalImages = faces.items.reduce((acc, group) => acc + group.image_count, 0)
        setStats({ totalFaces: totalImages, recentSightings: sightings.length })
      } catch (e) {
        console.error("Failed to load dashboard stats")
      }
    }
    loadStats()
  }, [])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of system performance and surveillance metrics.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFaces}</div>
            <p className="text-xs text-muted-foreground">Registered face identities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">24h Sightings</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentSightings}</div>
            <p className="text-xs text-muted-foreground">Detections since yesterday</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">System Status</CardTitle>
                <Activity className="h-4 w-4 text-primary animate-pulse" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">Online</div>
                <p className="text-xs text-primary/80">Recognition service active</p>
            </CardContent>
        </Card>
      </div>

    </div>
  )
}
