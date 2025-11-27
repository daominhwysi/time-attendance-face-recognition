// stream/hooks/use-camera.ts

import { useEffect, useState, useCallback, type RefObject, useRef } from 'react'

interface UseCameraProps {
  videoRef: RefObject<HTMLVideoElement | null>
  deviceId?: string
  orientation: 'landscape' | 'portrait'
  maxResolution?: number
}

export function useCamera({
  videoRef,
  deviceId,
  orientation,
  maxResolution = 1280,
}: UseCameraProps) {
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [resolution, setResolution] = useState({ width: 640, height: 480 })

  // Trigger to force re-initialization
  const [retryTrigger, setRetryTrigger] = useState(0)
  const retryTimeoutRef = useRef<any | null>(null)

  const fetchDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices.filter((d) => d.kind === 'videoinput')
      setDevices(videoDevices)
    } catch (err) {
      console.error(err)
    }
  }, [])

  // 1. Listen for hardware changes (USB unplugged/plugged)
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log('Hardware change detected. Refreshing...')
      fetchDevices()
      // Force camera restart
      setRetryTrigger((prev) => prev + 1)
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => {
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        handleDeviceChange
      )
    }
  }, [fetchDevices])

  // 2. Main Setup Logic
  useEffect(() => {
    let isMounted = true
    let stream: MediaStream | null = null

    async function setupCamera() {
      setIsReady(false)
      setError(null)

      try {
        // Cleanup previous stream
        if (videoRef.current && videoRef.current.srcObject) {
          const oldStream = videoRef.current.srcObject as MediaStream
          oldStream.getTracks().forEach((t) => t.stop())
        }

        const aspectRatio = orientation === 'landscape' ? 1.333333 : 0.75

        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: maxResolution },
            height: { ideal: maxResolution },
            aspectRatio: { ideal: aspectRatio },
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          },
        }

        stream = await navigator.mediaDevices.getUserMedia(constraints)

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        fetchDevices()

        // --- Watch for stream death (Browser stops it or privacy switch) ---
        stream.getVideoTracks()[0].onended = () => {
          console.warn('Video track ended unexpectedly. Restarting...')
          if (isMounted) setRetryTrigger((prev) => prev + 1)
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream

          videoRef.current.onloadedmetadata = () => {
            if (!videoRef.current) return
            const w = videoRef.current.videoWidth
            const h = videoRef.current.videoHeight
            console.log(`Camera started at: ${w}x${h}`)
            setResolution({ width: w, height: h })

            videoRef.current
              .play()
              .then(() => setIsReady(true))
              .catch((e) => console.error('Play error:', e))
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Camera Error:', err)
          setError('Could not access camera. Retrying in 3s...')

          // Auto Retry logic for Camera (e.g., if camera is busy being freed)
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
          retryTimeoutRef.current = setTimeout(() => {
            setRetryTrigger((prev) => prev + 1)
          }, 3000)
        }
      }
    }

    setupCamera()

    return () => {
      isMounted = false
      setIsReady(false)
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [
    videoRef,
    deviceId,
    orientation,
    fetchDevices,
    maxResolution,
    retryTrigger,
  ])

  return { isReady, error, devices, resolution }
}
