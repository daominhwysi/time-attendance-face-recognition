import { useRef, useState, useEffect, useCallback } from 'react'
import { StreamHeader } from '@/components/StreamHeader'
import { VideoDisplay } from '@/components/VideoDisplay'
import { useCamera } from '@/stream/hooks/use-camera'
import { useStreamProcessor } from '@/stream/hooks/use-stream-processor'

function StreamPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // NEW: Ref for the specific DIV we want to make full screen
  const containerRef = useRef<HTMLDivElement>(null)

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [isMirrored, setIsMirrored] = useState(true)

  // NEW: State to track fullscreen status
  const [isFullScreen, setIsFullScreen] = useState(false)

  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  )

  useEffect(() => {
    const handleResize = () => {
      const newOrientation =
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      setOrientation(newOrientation)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // --- NEW: Full Screen Logic ---
  const toggleFullScreen = useCallback(async () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen()
      } catch (err) {
        console.error('Error attempting to enable fullscreen:', err)
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      }
    }
  }, [])

  // Sync state with browser events (e.g. User presses ESC)
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullScreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullScreenChange)
  }, [])
  // -----------------------------

  const {
    isReady: isCameraReady,
    error: cameraError,
    devices,
    resolution,
  } = useCamera({
    videoRef,
    deviceId: selectedDeviceId || undefined,
    orientation,
    maxResolution: 1280,
  })

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

  // Calculate debug stats
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
        isFullScreen={isFullScreen} // Pass state
        onDeviceChange={handleDeviceChange}
        onToggleMirror={() => setIsMirrored((prev) => !prev)}
        onToggleFullScreen={toggleFullScreen} // Pass handler
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
        containerRef={containerRef} // Pass ref
        width={resolution.width}
        height={resolution.height}
        isMirrored={isMirrored}
        isFullScreen={isFullScreen} // Pass state for styling
        onToggleFullScreen={toggleFullScreen} // Pass handler for double-click
      />
    </div>
  )
}

export default StreamPage
