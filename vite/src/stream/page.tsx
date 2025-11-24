import { useRef, useState, useEffect } from 'react'
import { StreamHeader } from '@/components/StreamHeader'
import { VideoDisplay } from '@/components/VideoDisplay'
import { useCamera } from '@/stream/hooks/use-camera'
import { useStreamProcessor } from '@/stream/hooks/use-stream-processor'

function StreamPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')

  // Default to what the browser currently is
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  )

  // Default Mirror to TRUE for front cameras (Standard behavior)
  const [isMirrored, setIsMirrored] = useState(true)

  // --- AUTOMATIC ORIENTATION DETECTION ---
  useEffect(() => {
    const handleResize = () => {
      const newOrientation =
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      setOrientation(newOrientation)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  // ----------------------------------------

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

  // 2. Processor (Scales down to 640px for server)
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

  // Debug Stats
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
        <span>
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
