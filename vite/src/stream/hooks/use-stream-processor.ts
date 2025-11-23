import { useEffect, useRef, useState, type RefObject } from 'react'
import * as utils from '@/lib/stream-utils'

interface UseStreamProcessorProps {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  isCameraReady: boolean
  width: number
  height: number
}

// CHANGE: Target size is now 640
const TARGET_SEND_SIZE = 640

export function useStreamProcessor({
  videoRef,
  canvasRef,
  isCameraReady,
  width,
  height,
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

  // CHANGE: Calculate scale based on the LARGEST dimension
  // This ensures the output fits within a 640x640 box (e.g., 640x480 or 480x640)
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
        if (data.results && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d')
          if (ctx) {
            // Pass scaleFactor to draw boxes correctly on the High Res display
            utils.drawDetections(ctx, data.results, width, height, scaleFactor)
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
  }, [isCameraReady, canvasRef, width, height, scaleFactor])

  useEffect(() => {
    if (!isCameraReady || !videoRef.current) return

    runningRef.current = true

    const tinyCanvas = utils.createCanvas(utils.HASH_W, utils.HASH_H)
    const tinyCtx = tinyCanvas.getContext('2d')!
    const medCanvas = utils.createCanvas(utils.MEDIUM_W, utils.MEDIUM_H)
    const medCtx = medCanvas.getContext('2d')!

    // CHANGE: Calculate sending dimensions
    const sendW = Math.floor(width * scaleFactor)
    const sendH = Math.floor(height * scaleFactor)

    const sendCanvas = document.createElement('canvas')
    sendCanvas.width = sendW
    sendCanvas.height = sendH
    const sendCtx = sendCanvas.getContext('2d')!

    let lastSend = 0

    const loop = () => {
      if (!runningRef.current) return

      const video = videoRef.current
      const ws = wsRef.current

      if (
        video &&
        ws &&
        ws.readyState === WebSocket.OPEN &&
        video.readyState >= 2
      ) {
        // 1. Change Detection (Hash/MSE logic)
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

          const now = Date.now()
          if (
            isSignificantChange &&
            now - lastSend > utils.MIN_SEND_INTERVAL_MS
          ) {
            lastSend = now
            prevHashRef.current = currHash
            prevMediumGrayRef.current = currMedGray

            // 2. Draw to the small 640px canvas
            sendCtx.drawImage(video, 0, 0, sendW, sendH)

            const dataUrl = sendCanvas.toDataURL('image/jpeg', 0.8)
            ws.send(dataUrl)
            setLastDetectionTime(now)
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
