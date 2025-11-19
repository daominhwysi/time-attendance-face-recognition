// src/stream/page.tsx

import { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
const VIDEO_WIDTH = 640
const VIDEO_HEIGHT = 640
const FRAME_SEND_INTERVAL = 100

const HASH_W = 17
const HASH_H = 16
const MEDIUM_W = 112
const MEDIUM_H = 112
const HAMMING_THRESHOLD = 5
const MSE_CONFIRM_THRESHOLD = 5
const MIN_SEND_INTERVAL_MS = FRAME_SEND_INTERVAL

interface DetectionResult {
  box: [number, number, number, number]
  label: string
  score: number
}

function StreamPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const lastSentTimeRef = useRef(0)
  const [status, setStatus] = useState('Initializing...')
  const [lastDetectionTime, setLastDetectionTime] = useState<number | null>(
    null
  )

  // refs for detection state (persist across frames without re-renders)
  const prevHashRef = useRef<Uint8Array | null>(null)
  const prevMediumGrayRef = useRef<Uint8Array | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const runningRef = useRef(true)

  useEffect(() => {
    // 1. Get camera access
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setStatus('Camera ready. Connecting to server...')
        }
      } catch (err) {
        setStatus('Could not access camera. Please grant permission.')
        console.error('Error accessing camera:', err)
      }
    }

    setupCamera()
    const SOCKET_API_URL = import.meta.env.VITE_SOCKET_API_URL
    // 2. Setup WebSocket connection
    const ws = new WebSocket(`${SOCKET_API_URL}/stream/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('Connected. Recognition is active.')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.results) {
          drawDetections(data.results)
        }
      } catch (err) {
        console.error('Malformed ws message', err)
      }
    }

    ws.onclose = () => {
      setStatus('Connection closed. Please refresh the page.')
    }

    ws.onerror = (error) => {
      setStatus('Connection error. Check the console.')
      console.error('WebSocket Error:', error)
    }

    // Cleanup on unmount
    return () => {
      runningRef.current = false
      ws.close()
      const stream = videoRef.current?.srcObject as MediaStream | null
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  // ---------- helper functions for hashing / diff ----------
  function createCanvas(w: number, h: number) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }

  function getGrayscaleArrayFromCtx(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) {
    const img = ctx.getImageData(0, 0, w, h).data
    const gray = new Uint8Array(w * h)
    for (let i = 0, j = 0; i < img.length; i += 4, j++) {
      gray[j] = (0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2]) | 0
    }
    return gray
  }

  // compute dHash bits by comparing adjacent columns on tiny image
  function computeDHashBits(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) {
    const img = ctx.getImageData(0, 0, w, h).data
    const gray = new Uint8Array(w * h)
    for (let i = 0, j = 0; i < img.length; i += 4, j++) {
      gray[j] = (0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2]) | 0
    }
    const bits = new Uint8Array((w - 1) * h)
    let bi = 0
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w - 1; col++) {
        const a = gray[row * w + col]
        const b = gray[row * w + col + 1]
        bits[bi++] = a > b ? 1 : 0
      }
    }
    return bits
  }

  function hammingDistance(a: Uint8Array, b: Uint8Array) {
    let d = 0
    const n = Math.min(a.length, b.length)
    for (let i = 0; i < n; i++) {
      if (a[i] !== b[i]) d++
    }
    return d
  }

  // RMS (root mean square) grayscale diff between two same-length grayscale arrays
  function grayscaleMSE(a: Uint8Array, b: Uint8Array) {
    let s = 0
    const n = Math.min(a.length, b.length)
    for (let i = 0; i < n; i++) {
      const diff = a[i] - b[i]
      s += diff * diff
    }
    return Math.sqrt(s / n)
  }

  // ---------- send loop with fast detection ----------
  useEffect(() => {
    if (!videoRef.current) return
    runningRef.current = true

    const tinyCanvas = createCanvas(HASH_W, HASH_H)
    const tinyCtx = tinyCanvas.getContext('2d')!
    const medCanvas = createCanvas(MEDIUM_W, MEDIUM_H)
    const medCtx = medCanvas.getContext('2d')!

    // Hidden canvas used to produce the jpeg/dataURL that we send
    const sendCanvas = document.createElement('canvas')
    sendCanvas.width = VIDEO_WIDTH
    sendCanvas.height = VIDEO_HEIGHT
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
        // Stage 1: Luôn tính hash của frame hiện tại
        tinyCtx.drawImage(video, 0, 0, HASH_W, HASH_H)
        const currHash = computeDHashBits(tinyCtx, HASH_W, HASH_H)

        // So sánh với frame đã gửi lần cuối
        const lastSentHash = prevHashRef.current // Sử dụng lại tên cũ cho đơn giản
        const hamDiff = lastSentHash
          ? hammingDistance(lastSentHash, currHash)
          : Infinity

        let isSignificantChange = false

        if (!lastSentHash || hamDiff >= HAMMING_THRESHOLD) {
          // Có khả năng thay đổi -> Stage 2 để xác nhận
          medCtx.drawImage(video, 0, 0, MEDIUM_W, MEDIUM_H)
          const currMedGray = getGrayscaleArrayFromCtx(
            medCtx,
            MEDIUM_W,
            MEDIUM_H
          )

          const lastSentMedGray = prevMediumGrayRef.current
          if (!lastSentMedGray) {
            isSignificantChange = true // Lần đầu tiên, luôn coi là thay đổi
          } else {
            const mse = grayscaleMSE(lastSentMedGray, currMedGray)
            if (mse >= MSE_CONFIRM_THRESHOLD) {
              isSignificantChange = true
            }
          }

          const now = Date.now()
          if (isSignificantChange && now - lastSend > MIN_SEND_INTERVAL_MS) {
            lastSend = now

            // Quyết định gửi! Cập nhật các ref tham chiếu
            prevHashRef.current = currHash
            prevMediumGrayRef.current = currMedGray

            // Vẽ và gửi frame đầy đủ
            sendCtx.drawImage(video, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
            const dataUrl = sendCanvas.toDataURL('image/jpeg', 0.8)
            try {
              ws.send(dataUrl)
              lastSentTimeRef.current = now
              // THÊM VÀO: Cập nhật state thời gian để hiển thị trên UI
              setLastDetectionTime(now)
            } catch (err) {
              console.error('Failed to send frame', err)
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    // Start loop when video is playing
    const startIfReady = () => {
      if (animFrameRef.current == null) {
        animFrameRef.current = requestAnimationFrame(loop)
      }
    }

    if (videoRef.current) {
      videoRef.current.onloadedmetadata = startIfReady
      // fallback
      setTimeout(startIfReady, 500)
    }

    return () => {
      runningRef.current = false
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once

  // 4. Draw received detections on the visible canvas
  const drawDetections = (detections: DetectionResult[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    detections.forEach(({ box, label, score }) => {
      const [x1, y1, x2, y2] = box
      const width = x2 - x1
      const height = y2 - y1

      // Draw bounding box
      ctx.strokeStyle = 'lime'
      ctx.lineWidth = 2
      ctx.strokeRect(x1, y1, width, height)

      // Draw label background
      ctx.fillStyle = 'lime'
      const text = `${label} (${score.toFixed(2)})`
      const textWidth = ctx.measureText(text).width
      ctx.fillRect(x1, y1 - 20, textWidth + 10, 20)

      // Draw label text
      ctx.fillStyle = 'black'
      ctx.font = '16px sans-serif'
      ctx.fillText(text, x1 + 5, y1 - 5)
    })
  }

return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Live Monitor</h1>
            <p className="text-muted-foreground flex items-center gap-2">
                Status:
                <Badge variant={wsRef.current?.readyState === 1 ? "default" : "destructive"}>
                    {status}
                </Badge>
            </p>
        </div>
        <div className="text-sm font-mono bg-muted px-3 py-1 rounded-md">
            Last Activity: {lastDetectionTime ? new Date(lastDetectionTime).toLocaleTimeString() : '--:--:--'}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-black rounded-xl overflow-hidden shadow-2xl relative">
         {/* The Video Container */}
         <div className="relative w-full max-w-[800px] aspect-square md:aspect-video bg-gray-900">
            <video
              ref={videoRef}
              width={VIDEO_WIDTH}
              height={VIDEO_HEIGHT}
              className="w-full h-full object-contain"
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              width={VIDEO_WIDTH}
              height={VIDEO_HEIGHT}
              className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
            />

            {/* Overlay UI elements */}
            <div className="absolute top-4 right-4 flex gap-2">
                <div className="animate-pulse h-3 w-3 bg-red-600 rounded-full"></div>
                <span className="text-xs text-white font-mono bg-black/50 px-2 rounded">LIVE</span>
            </div>
         </div>
      </div>
    </div>
  )
}

export default StreamPage
