import { useRef, useState } from 'react'
import { StreamHeader } from '@/components/StreamHeader'
import { VideoDisplay } from '@/components/VideoDisplay'
import { useCamera } from '@/stream/hooks/use-camera'
import { useStreamProcessor } from '@/stream/hooks/use-stream-processor'

// Define base dimensions
const BASE_LONG = 640
const BASE_SHORT = 480

function StreamPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape'
  )

  // Calculate current dimensions based on orientation
  const width = orientation === 'landscape' ? BASE_LONG : BASE_SHORT
  const height = orientation === 'landscape' ? BASE_SHORT : BASE_LONG

  // 1. Setup Camera
  const {
    isReady: isCameraReady,
    error: cameraError,
    devices,
  } = useCamera({
    videoRef,
    deviceId: selectedDeviceId || undefined,
    width,
    height,
  })

  // 2. Setup Processing
  const { status, lastDetectionTime, readyState } = useStreamProcessor({
    videoRef,
    canvasRef,
    isCameraReady,
    width,
    height,
  })

  const handleDeviceChange = (val: string) => {
    setSelectedDeviceId(val === 'auto' ? '' : val)
  }

  const handleToggleOrientation = () => {
    setOrientation((prev) => (prev === 'landscape' ? 'portrait' : 'landscape'))
  }

  const displayStatus =
    cameraError || (isCameraReady ? status : 'Initializing Camera...')

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

      <VideoDisplay
        videoRef={videoRef}
        canvasRef={canvasRef}
        width={width}
        height={height}
      />
    </div>
  )
}

export default StreamPage
