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

// 1. LIMIT FPS: 5 FPS is enough for detection
const PROCESSING_FPS = 5
const MIN_TIME_BETWEEN_FRAMES = 1000 / PROCESSING_FPS
const TARGET_SEND_SIZE = 640
const TIMEOUT_MS = 2000 // 2 seconds timeout

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

  // --- NEW: Flow Control Refs ---
  const isPendingServerResponse = useRef(false) // Flag: Are we waiting for server?
  const lastSendTimeRef = useRef<number>(0) // Timestamp: When did we last send?

  const maxDimension = Math.max(width, height)
  const scaleFactor =
    maxDimension > TARGET_SEND_SIZE ? TARGET_SEND_SIZE / maxDimension : 1

  // 1. WebSocket Connection Setup
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

    ws.onopen = () => {
      setStatus('Connected.')
      isPendingServerResponse.current = false
    }

    ws.onmessage = (event) => {
      // --- CRITICAL: Server responded, unlock flow ---
      isPendingServerResponse.current = false

      try {
        const data = JSON.parse(event.data)
        const detections = data.results || []

        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d', {
            willReadFrequently: false,
          })
          if (ctx) {
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

    ws.onclose = (e) => {
      setStatus(e.code === 1008 ? 'Session Expired' : 'Disconnected')
      isPendingServerResponse.current = false
    }

    return () => {
      if (ws.readyState === 1) ws.close()
    }
  }, [isCameraReady, canvasRef, width, height, scaleFactor, isMirrored])

  // 2. Processing Loop
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

      // A. Throttle CPU (FPS Limit)
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
        // --- B. APPLICATION FLOW CONTROL (STOP-AND-WAIT) ---
        if (isPendingServerResponse.current) {
          // Check Timeout (Fail-safe)
          if (now - lastSendTimeRef.current > TIMEOUT_MS) {
            console.warn('⚠️ Server response timeout. Forcing reset.')
            isPendingServerResponse.current = false // Force unlock
          } else {
            // Still waiting within allowed time -> Skip this frame
            animFrameRef.current = requestAnimationFrame(loop)
            return
          }
        }

        // --- C. NETWORK LAYER BACKPRESSURE CHECK ---
        if (ws.bufferedAmount > 0) {
          animFrameRef.current = requestAnimationFrame(loop)
          return
        }

        // --- D. MOTION DETECTION ---
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

          // --- E. SEND DATA ---
          if (
            isSignificantChange &&
            now - lastSend > utils.MIN_SEND_INTERVAL_MS
          ) {
            lastSend = now

            // Lock the flow
            isPendingServerResponse.current = true
            lastSendTimeRef.current = now

            prevHashRef.current = currHash
            prevMediumGrayRef.current = currMedGray

            sendCtx.drawImage(video, 0, 0, sendW, sendH)
            const dataUrl = sendCanvas.toDataURL('image/webp', 0.7)

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
