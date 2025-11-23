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

  // 1. Setup Camera (It now calculates max res internally)
  const {
    isReady: isCameraReady,
    error: cameraError,
    devices,
    resolution, // <--- This is the ACTUAL Max Res from hardware
  } = useCamera({
    videoRef,
    deviceId: selectedDeviceId || undefined,
    orientation,
  })

  // 2. Setup Processing
  // We pass the resolution from the hook to the processor
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

      {/* Display resolution stats for debugging/confirmation */}
      <div className="mb-2 text-center text-xs text-gray-500">
        Running at: {resolution.width}x{resolution.height}
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
