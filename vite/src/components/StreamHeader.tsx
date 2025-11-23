import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RotateCw } from 'lucide-react'

interface StreamHeaderProps {
  status: string
  isSocketConnected: boolean
  lastDetectionTime: number | null
  devices: MediaDeviceInfo[]
  selectedDeviceId: string
  orientation: 'landscape' | 'portrait'
  onDeviceChange: (id: string) => void
  onToggleOrientation: () => void
}

export function StreamHeader({
  status,
  isSocketConnected,
  devices,
  selectedDeviceId,
  orientation,
  onDeviceChange,
  onToggleOrientation,
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
            {orientation === 'landscape'
              ? 'Horizontal (4:3)'
              : 'Vertical (3:4)'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedDeviceId} onValueChange={onDeviceChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Camera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Default Camera</SelectItem>
            {devices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={onToggleOrientation}
          title="Switch Orientation (Landscape/Portrait)"
        >
          <RotateCw
            className={`h-4 w-4 transition-transform ${orientation === 'portrait' ? 'rotate-90' : ''}`}
          />
        </Button>
      </div>
    </div>
  )
}
