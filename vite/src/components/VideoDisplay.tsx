import { type RefObject } from 'react'
import { Minimize } from 'lucide-react'

interface VideoDisplayProps {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  containerRef: RefObject<HTMLDivElement | null> // NEW: Ref for the wrapper
  width: number
  height: number
  isMirrored: boolean
  isFullScreen: boolean // NEW
  onToggleFullScreen: () => void // NEW
}

export function VideoDisplay({
  videoRef,
  canvasRef,
  containerRef,
  width,
  height,
  isMirrored,
  isFullScreen,
  onToggleFullScreen,
}: VideoDisplayProps) {
  return (
    <div
      ref={containerRef}
      className={`relative flex flex-1 items-center justify-center overflow-hidden bg-black shadow-2xl transition-all ${isFullScreen ? 'h-screen w-screen rounded-none' : 'rounded-xl'}`}
      onDoubleClick={onToggleFullScreen} // Feature: Double click to toggle
    >
      <div
        className="relative bg-gray-900 transition-all duration-300"
        style={{
          width: '100%',
          // When fullscreen, we want it to fit the screen height, otherwise limit it
          maxWidth: isFullScreen ? '100%' : width > height ? '800px' : '480px',
          height: isFullScreen ? '100%' : 'auto',
          aspectRatio: `${width}/${height}`,
        }}
      >
        <video
          ref={videoRef}
          width={width}
          height={height}
          className="h-full w-full object-contain"
          style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
          playsInline
          muted
        />

        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="pointer-events-none absolute top-0 left-0 h-full w-full object-contain"
        />

        {/* Optional: Floating Exit Button when in Full Screen */}
        {isFullScreen && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleFullScreen()
            }}
            className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/80"
          >
            <Minimize className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  )
}
