import { useEffect, useState, useCallback, type RefObject } from 'react'

interface UseCameraProps {
  videoRef: RefObject<HTMLVideoElement | null>
  deviceId?: string
  orientation: 'landscape' | 'portrait'
}

export function useCamera({ videoRef, deviceId, orientation }: UseCameraProps) {
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  // Store the ACTUAL resolution the camera decides to give us
  const [resolution, setResolution] = useState({ width: 640, height: 480 })

  const fetchDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices.filter((d) => d.kind === 'videoinput')
      setDevices(videoDevices)
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    let stream: MediaStream | null = null

    async function setupCamera() {
      setIsReady(false)
      setError(null)

      try {
        // Stop previous
        if (videoRef.current && videoRef.current.srcObject) {
          const oldStream = videoRef.current.srcObject as MediaStream
          oldStream.getTracks().forEach((t) => t.stop())
        }

        // 1. Determine Aspect Ratio
        const aspectRatio =
          orientation === 'landscape'
            ? 1.333333 // 4:3
            : 0.75 // 3:4

        // 2. Ask for "Max" resolution with that aspect ratio
        // "ideal: 4096" tells browser to go as high as hardware allows
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 4096 },
            height: { ideal: 4096 },
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

        if (videoRef.current) {
          videoRef.current.srcObject = stream

          // 3. Wait for video to load metadata to get REAL dimensions
          videoRef.current.onloadedmetadata = () => {
            if (!videoRef.current) return

            // Read what the hardware actually provided
            const w = videoRef.current.videoWidth
            const h = videoRef.current.videoHeight

            console.log(`Camera started at: ${w}x${h}`)
            setResolution({ width: w, height: h })

            videoRef.current.play().catch((e) => console.error(e))
            setIsReady(true)
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('Could not access camera. Please grant permission.')
          console.error(err)
        }
      }
    }

    setupCamera()

    return () => {
      isMounted = false
      setIsReady(false)
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [videoRef, deviceId, orientation, fetchDevices])

  return { isReady, error, devices, resolution }
}
