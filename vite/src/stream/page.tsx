// stream/page.tsx

import { useRef, useState, useEffect } from 'react'
import { StreamHeader } from '@/components/StreamHeader'
import { VideoDisplay } from '@/components/VideoDisplay'
import { useCamera } from '@/stream/hooks/use-camera'
import { useStreamProcessor } from '@/stream/hooks/use-stream-processor'

function StreamPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')

  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  )

  const [isMirrored, setIsMirrored] = useState(true)

  useEffect(() => {
    const handleResize = () => {
      const newOrientation =
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      setOrientation(newOrientation)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 1. Camera
  const {
    isReady: isCameraReady,
    error: cameraError,
    devices,
    resolution,
  } = useCamera({
    videoRef,
    deviceId: selectedDeviceId || undefined,
    orientation,
    // ADDED: Cap resolution to 720p (1280x720).
    // This reduces CPU load significantly compared to 4K.
    maxResolution: 1280,
  })

  // 2. Processor
  const { status, lastDetectionTime, readyState } = useStreamProcessor({
    videoRef,
    canvasRef,
    isCameraReady,
    width: resolution.width,
    height: resolution.height,
    isMirrored: isMirrored,
  })

  const handleDeviceChange = (val: string) => {
    setSelectedDeviceId(val === 'auto' ? '' : val)
  }

  const displayStatus =
    cameraError || (isCameraReady ? status : 'Initializing Camera...')

  // Debug Stats calculation...
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
        isMirrored={isMirrored}
        onDeviceChange={handleDeviceChange}
        onToggleMirror={() => setIsMirrored((prev) => !prev)}
      />

      <div className="mb-2 flex justify-center gap-4 text-center font-mono text-xs text-gray-500">
        <span>{orientation.toUpperCase()}</span>
        <span
          className={
            resolution.width > 1280 ? 'text-red-500' : 'text-green-600'
          }
        >
          Cam: {resolution.width}x{resolution.height}
        </span>
        <span>
          Net: {sendW}x{sendH}
        </span>
      </div>

      <VideoDisplay
        videoRef={videoRef}
        canvasRef={canvasRef}
        width={resolution.width}
        height={resolution.height}
        isMirrored={isMirrored}
      />
    </div>
  )
}

export default StreamPage
