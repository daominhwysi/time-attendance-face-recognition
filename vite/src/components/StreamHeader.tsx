import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FlipHorizontal, Maximize, Minimize } from 'lucide-react' // Added Icons

interface StreamHeaderProps {
  status: string
  isSocketConnected: boolean
  lastDetectionTime: number | null
  devices: MediaDeviceInfo[]
  selectedDeviceId: string
  isMirrored: boolean
  isFullScreen: boolean // NEW
  onDeviceChange: (id: string) => void
  onToggleMirror: () => void
  onToggleFullScreen: () => void // NEW
}

export function StreamHeader({
  status,
  isSocketConnected,
  lastDetectionTime,
  devices,
  selectedDeviceId,
  isMirrored,
  isFullScreen,
  onDeviceChange,
  onToggleMirror,
  onToggleFullScreen,
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

        <Button
          variant={isMirrored ? 'default' : 'outline'}
          size="icon"
          onClick={onToggleMirror}
          title="Mirror Video"
        >
          <FlipHorizontal className="h-4 w-4" />
        </Button>

        {/* Full Screen Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleFullScreen}
          title={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
        >
          {isFullScreen ? (
            <Minimize className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
