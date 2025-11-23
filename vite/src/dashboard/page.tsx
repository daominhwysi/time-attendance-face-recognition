// frontend/dashboard/page.tsx

import { useEffect, useState } from 'react'
import { Users, History, Activity, Fingerprint } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getDashboardStats, type DashboardStats } from '@/api/api'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    total_identities: 0,
    total_images: 0,
    recent_sightings: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getDashboardStats()
        setStats(data)
      } catch (e) {
        console.error('Failed to load dashboard stats', e)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of system performance and surveillance metrics.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Size</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : stats.total_images}
            </div>
            <p className="text-muted-foreground text-xs">
              {loading
                ? 'Loading...'
                : `${stats.total_identities} distinct identities`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">24h Sightings</CardTitle>
            <History className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : stats.recent_sightings}
            </div>
            <p className="text-muted-foreground text-xs">
              Detections since yesterday
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-primary text-sm font-medium">
              System Status
            </CardTitle>
            <Activity className="text-primary h-4 w-4 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-primary text-2xl font-bold">Online</div>
            <p className="text-primary/80 text-xs">
              Recognition service active
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
