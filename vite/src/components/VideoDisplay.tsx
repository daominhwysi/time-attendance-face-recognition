import { type RefObject } from 'react'

interface VideoDisplayProps {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  width: number
  height: number
}

export function VideoDisplay({
  videoRef,
  canvasRef,
  width,
  height,
}: VideoDisplayProps) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-black shadow-2xl">
      {/* Container adapts max-width based on aspect ratio for better viewing */}
      <div
        className="relative bg-gray-900 transition-all duration-300"
        style={{
          width: '100%',
          maxWidth: width > height ? '800px' : '480px', // Adjust max-width based on orientation
          aspectRatio: `${width}/${height}`,
        }}
      >
        <video
          ref={videoRef}
          width={width}
          height={height}
          className="h-full w-full object-contain"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="pointer-events-none absolute top-0 left-0 h-full w-full object-contain"
        />
      </div>
    </div>
  )
}
