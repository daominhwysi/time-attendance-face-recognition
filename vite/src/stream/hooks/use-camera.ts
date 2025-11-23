import { useEffect, useState, useCallback, type RefObject } from 'react'

interface UseCameraProps {
  videoRef: RefObject<HTMLVideoElement | null>
  deviceId?: string
  width: number
  height: number
}

export function useCamera({
  videoRef,
  deviceId,
  width,
  height,
}: UseCameraProps) {
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  const fetchDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices.filter((d) => d.kind === 'videoinput')
      setDevices(videoDevices)
    } catch (err) {
      console.error('Error listing devices:', err)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    let stream: MediaStream | null = null

    async function setupCamera() {
      setIsReady(false)
      setError(null)

      try {
        // Stop previous stream
        if (videoRef.current && videoRef.current.srcObject) {
          const oldStream = videoRef.current.srcObject as MediaStream
          oldStream.getTracks().forEach((t) => t.stop())
        }

        // Apply dimensions to constraints
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: width },
            height: { ideal: height },
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
          try {
            await videoRef.current.play()
            setIsReady(true)
          } catch (err) {
            if (isMounted) console.error('Video play error:', err)
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('Could not access camera. Please grant permission.')
          console.error('Error accessing camera:', err)
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
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [videoRef, deviceId, width, height, fetchDevices])

  return { isReady, error, devices }
}
