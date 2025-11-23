import { useRef, useState } from 'react'
import { StreamHeader } from '@/components/StreamHeader'
import { VideoDisplay } from '@/components/VideoDisplay'
import { useCamera } from '@/stream/hooks/use-camera'
import { useStreamProcessor } from '@/stream/hooks/use-stream-processor'

function StreamPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape'
  )

  // 1. Camera (High Res)
  const {
    isReady: isCameraReady,
    error: cameraError,
    devices,
    resolution,
  } = useCamera({
    videoRef,
    deviceId: selectedDeviceId || undefined,
    orientation,
  })

  // 2. Processor (Scales down to max 640px)
  const { status, lastDetectionTime, readyState } = useStreamProcessor({
    videoRef,
    canvasRef,
    isCameraReady,
    width: resolution.width,
    height: resolution.height,
  })

  const handleDeviceChange = (val: string) => {
    setSelectedDeviceId(val === 'auto' ? '' : val)
  }

  const handleToggleOrientation = () => {
    setOrientation((prev) => (prev === 'landscape' ? 'portrait' : 'landscape'))
  }

  const displayStatus =
    cameraError || (isCameraReady ? status : 'Initializing Camera...')

  // Debug Stats Calculation
  const TARGET_SEND_SIZE = 640
  const maxDim = Math.max(resolution.width, resolution.height)
  const scale = maxDim > TARGET_SEND_SIZE ? TARGET_SEND_SIZE / maxDim : 1

  const sendW = Math.floor(resolution.width * scale)
  const sendH = Math.floor(resolution.height * scale)

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4">
      <StreamHeader
        status={displayStatus}
        isSocketConnected={readyState === 1}
        lastDetectionTime={lastDetectionTime}
        devices={devices}
        selectedDeviceId={selectedDeviceId || 'auto'}
        orientation={orientation}
        onDeviceChange={handleDeviceChange}
        onToggleOrientation={handleToggleOrientation}
      />

      <div className="mb-2 flex justify-center gap-4 text-center font-mono text-xs text-gray-500">
        <span>
          Display: {resolution.width}x{resolution.height}
        </span>
        <span>
          Network: {sendW}x{sendH} ({(scale * 100).toFixed(0)}%)
        </span>
      </div>

      <VideoDisplay
        videoRef={videoRef}
        canvasRef={canvasRef}
        width={resolution.width}
        height={resolution.height}
      />
    </div>
  )
}

export default StreamPage
