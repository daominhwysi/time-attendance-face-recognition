import { useEffect, useRef, useState, type RefObject } from 'react'
import * as utils from '@/lib/stream-utils'

interface UseStreamProcessorProps {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  isCameraReady: boolean
  width: number
  height: number
  isMirrored: boolean
}

// 1. LIMIT FPS: 15 FPS is plenty for detection.
const PROCESSING_FPS = 5
const MIN_TIME_BETWEEN_FRAMES = 1000 / PROCESSING_FPS
const TARGET_SEND_SIZE = 640

export function useStreamProcessor({
  videoRef,
  canvasRef,
  isCameraReady,
  width,
  height,
  isMirrored,
}: UseStreamProcessorProps) {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState('Initializing...')
  const [lastDetectionTime, setLastDetectionTime] = useState<number | null>(
    null
  )

  const prevHashRef = useRef<Uint8Array | null>(null)
  const prevMediumGrayRef = useRef<Uint8Array | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const lastStateUpdateRef = useRef<number>(0)

  const maxDimension = Math.max(width, height)
  const scaleFactor =
    maxDimension > TARGET_SEND_SIZE ? TARGET_SEND_SIZE / maxDimension : 1

  useEffect(() => {
    if (!isCameraReady) return

    const SOCKET_API_URL =
      import.meta.env.VITE_SOCKET_API_URL || 'ws://localhost:8000'
    const token = localStorage.getItem('access_token')

    if (!token) {
      setStatus('Authentication error.')
      return
    }

    let wsUrl = SOCKET_API_URL.replace(/^http/, 'ws')
    const ws = new WebSocket(`${wsUrl}/stream/ws?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => setStatus('Connected.')

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // --- THE FIX FOR STUCK BOXES ---
        // Your backend returns [] when no faces are found.
        // We defaults to [] if data.results is null/undefined.
        const detections = data.results || []
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d', {
            willReadFrequently: false,
          })
          if (ctx) {
            // We ALWAYS call this.
            // If detections is [], drawDetections will just run ctx.clearRect()
            // and loop 0 times, effectively erasing the screen.
            utils.drawDetections(
              ctx,
              detections,
              width,
              height,
              scaleFactor,
              isMirrored
            )
          }
        }
      } catch (err) {
        console.error(err)
      }
    }

    ws.onclose = (e) =>
      setStatus(e.code === 1008 ? 'Session Expired' : 'Disconnected')

    return () => {
      if (ws.readyState === 1) ws.close()
    }
  }, [isCameraReady, canvasRef, width, height, scaleFactor, isMirrored])

  useEffect(() => {
    if (!isCameraReady || !videoRef.current) return

    runningRef.current = true

    const tinyCanvas = utils.createCanvas(utils.HASH_W, utils.HASH_H)
    const tinyCtx = tinyCanvas.getContext('2d', { willReadFrequently: true })!

    const medCanvas = utils.createCanvas(utils.MEDIUM_W, utils.MEDIUM_H)
    const medCtx = medCanvas.getContext('2d', { willReadFrequently: true })!

    const sendW = Math.floor(width * scaleFactor)
    const sendH = Math.floor(height * scaleFactor)

    const sendCanvas = document.createElement('canvas')
    sendCanvas.width = sendW
    sendCanvas.height = sendH
    const sendCtx = sendCanvas.getContext('2d', { willReadFrequently: false })!

    let lastSend = 0
    let lastLoopTime = 0

    const loop = () => {
      if (!runningRef.current) return

      const now = Date.now()
      const elapsed = now - lastLoopTime

      // 1. Throttle CPU (FPS Limit)
      if (elapsed < MIN_TIME_BETWEEN_FRAMES) {
        animFrameRef.current = requestAnimationFrame(loop)
        return
      }
      lastLoopTime = now - (elapsed % MIN_TIME_BETWEEN_FRAMES)

      const video = videoRef.current
      const ws = wsRef.current

      if (
        video &&
        ws &&
        ws.readyState === WebSocket.OPEN &&
        video.readyState >= 2
      ) {
        // 2. Prevent Request Queuing (Backpressure)
        // If bufferedAmount > 0, the previous frame is still uploading.
        // We drop this frame to prevent lag accumulation on iPhone.
        if (ws.bufferedAmount > 0) {
          animFrameRef.current = requestAnimationFrame(loop)
          return
        }

        tinyCtx.drawImage(video, 0, 0, utils.HASH_W, utils.HASH_H)
        const currHash = utils.computeDHashBits(
          tinyCtx,
          utils.HASH_W,
          utils.HASH_H
        )

        const lastSentHash = prevHashRef.current
        const hamDiff = lastSentHash
          ? utils.hammingDistance(lastSentHash, currHash)
          : Infinity

        let isSignificantChange = false

        if (!lastSentHash || hamDiff >= utils.HAMMING_THRESHOLD) {
          medCtx.drawImage(video, 0, 0, utils.MEDIUM_W, utils.MEDIUM_H)
          const currMedGray = utils.getGrayscaleArrayFromCtx(
            medCtx,
            utils.MEDIUM_W,
            utils.MEDIUM_H
          )

          const lastSentMedGray = prevMediumGrayRef.current
          if (!lastSentMedGray) {
            isSignificantChange = true
          } else {
            const mse = utils.grayscaleMSE(lastSentMedGray, currMedGray)
            if (mse >= utils.MSE_CONFIRM_THRESHOLD) isSignificantChange = true
          }

          if (
            isSignificantChange &&
            now - lastSend > utils.MIN_SEND_INTERVAL_MS
          ) {
            lastSend = now
            prevHashRef.current = currHash
            prevMediumGrayRef.current = currMedGray

            sendCtx.drawImage(video, 0, 0, sendW, sendH)

            // Lower quality to 0.6 for speed
            const dataUrl = sendCanvas.toDataURL('image/jpeg', 0.6)
            ws.send(dataUrl)

            if (now - lastStateUpdateRef.current > 1000) {
              setLastDetectionTime(now)
              lastStateUpdateRef.current = now
            }
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      runningRef.current = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isCameraReady, videoRef, width, height, scaleFactor])

  return { status, lastDetectionTime, readyState: wsRef.current?.readyState }
}
