import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FlipHorizontal } from 'lucide-react'

interface StreamHeaderProps {
  status: string
  isSocketConnected: boolean
  lastDetectionTime: number | null
  devices: MediaDeviceInfo[]
  selectedDeviceId: string
  isMirrored: boolean // NEW
  onDeviceChange: (id: string) => void
  onToggleMirror: () => void // NEW
}

export function StreamHeader({
  status,
  isSocketConnected,
  lastDetectionTime,
  devices,
  selectedDeviceId,
  isMirrored,
  onDeviceChange,
  onToggleMirror,
}: StreamHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Live Monitor</h1>
        <div className="text-muted-foreground mt-1 flex items-center gap-2">
          <Badge variant={isSocketConnected ? 'default' : 'destructive'}>
            {status}
          </Badge>
          <span className="font-mono text-xs">
            Last:{' '}
            {lastDetectionTime
              ? new Date(lastDetectionTime).toLocaleTimeString()
              : '--:--:--'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedDeviceId} onValueChange={onDeviceChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Camera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Default Camera</SelectItem>
            {devices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 4)}...`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Mirror Button (Fixes Upside down/backwards issues) */}
        <Button
          variant={isMirrored ? 'default' : 'outline'}
          size="icon"
          onClick={onToggleMirror}
          title="Mirror Video"
        >
          <FlipHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
