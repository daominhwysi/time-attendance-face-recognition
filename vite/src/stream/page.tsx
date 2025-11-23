import { useRef, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'

// Use standard 4:3 aspect ratio to prevent distortion
const VIDEO_WIDTH = 640
const VIDEO_HEIGHT = 480

// ... constants (HASH_W, etc.) remain the same ...
const HASH_W = 17
const HASH_H = 16
const MEDIUM_W = 112
const MEDIUM_H = 112
const HAMMING_THRESHOLD = 5
const MSE_CONFIRM_THRESHOLD = 5
const MIN_SEND_INTERVAL_MS = 100

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

  // Refs for logic
  const prevHashRef = useRef<Uint8Array | null>(null)
  const prevMediumGrayRef = useRef<Uint8Array | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const runningRef = useRef(true)

  useEffect(() => {
    let isMounted = true // Fix AbortError race condition

    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
        })

        // If component unmounted while loading camera, stop immediately
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // Wrap play in try/catch to handle AbortError gracefully
          try {
            await videoRef.current.play()
            setStatus('Camera ready. Connecting to server...')
            connectWebSocket() // Only connect after camera is ready
          } catch (err) {
            if (isMounted) console.error('Video play error:', err)
          }
        }
      } catch (err) {
        if (isMounted) {
          setStatus('Could not access camera. Please grant permission.')
          console.error('Error accessing camera:', err)
        }
      }
    }

    function connectWebSocket() {
      const SOCKET_API_URL =
        import.meta.env.VITE_SOCKET_API_URL || 'ws://localhost:8000'
      const token = localStorage.getItem('access_token')

      if (!token) {
        setStatus('Authentication error. Please log in again.')
        return
      }

      // Normalize URL
      let wsUrl = SOCKET_API_URL
      if (wsUrl.startsWith('http')) {
        wsUrl = wsUrl.replace(/^http/, 'ws')
      }

      console.log(
        'Connecting to WS:',
        `${wsUrl}/stream/ws?token=${token.substring(0, 10)}...`
      )

      const ws = new WebSocket(`${wsUrl}/stream/ws?token=${token}`)
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

      ws.onclose = (event) => {
        console.log('WS Closed:', event.code, event.reason)
        if (event.code === 1008) {
          setStatus(`Session expired or Invalid Token. (${event.reason})`)
        } else {
          setStatus('Connection closed. Reconnecting...')
        }
      }

      ws.onerror = (error) => {
        // WebSocket Error event doesn't contain details for security reasons
        console.error('WebSocket Error Event:', error)
        setStatus('Connection Error. Check server logs.')
      }
    }

    setupCamera()

    return () => {
      isMounted = false
      runningRef.current = false

      if (wsRef.current) {
        wsRef.current.close()
      }

      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        videoRef.current.srcObject = null
      }

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [])

  // ... (Helper functions: createCanvas, getGrayscaleArrayFromCtx, etc. KEEP THESE THE SAME) ...
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

  function grayscaleMSE(a: Uint8Array, b: Uint8Array) {
    let s = 0
    const n = Math.min(a.length, b.length)
    for (let i = 0; i < n; i++) {
      const diff = a[i] - b[i]
      s += diff * diff
    }
    return Math.sqrt(s / n)
  }

  useEffect(() => {
    if (!videoRef.current) return
    runningRef.current = true

    const tinyCanvas = createCanvas(HASH_W, HASH_H)
    const tinyCtx = tinyCanvas.getContext('2d')!
    const medCanvas = createCanvas(MEDIUM_W, MEDIUM_H)
    const medCtx = medCanvas.getContext('2d')!

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
        // 1. Compute Hash
        tinyCtx.drawImage(video, 0, 0, HASH_W, HASH_H)
        const currHash = computeDHashBits(tinyCtx, HASH_W, HASH_H)

        const lastSentHash = prevHashRef.current
        const hamDiff = lastSentHash
          ? hammingDistance(lastSentHash, currHash)
          : Infinity

        let isSignificantChange = false

        if (!lastSentHash || hamDiff >= HAMMING_THRESHOLD) {
          // 2. Confirm with Grayscale MSE
          medCtx.drawImage(video, 0, 0, MEDIUM_W, MEDIUM_H)
          const currMedGray = getGrayscaleArrayFromCtx(
            medCtx,
            MEDIUM_W,
            MEDIUM_H
          )

          const lastSentMedGray = prevMediumGrayRef.current
          if (!lastSentMedGray) {
            isSignificantChange = true
          } else {
            const mse = grayscaleMSE(lastSentMedGray, currMedGray)
            if (mse >= MSE_CONFIRM_THRESHOLD) {
              isSignificantChange = true
            }
          }

          const now = Date.now()
          if (isSignificantChange && now - lastSend > MIN_SEND_INTERVAL_MS) {
            lastSend = now
            prevHashRef.current = currHash
            prevMediumGrayRef.current = currMedGray

            sendCtx.drawImage(video, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
            const dataUrl = sendCanvas.toDataURL('image/jpeg', 0.8)
            ws.send(dataUrl)
            lastSentTimeRef.current = now
            setLastDetectionTime(now)
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(loop)
    }

    // Wait for video metadata before starting loop
    if (videoRef.current) {
      videoRef.current.addEventListener(
        'loadedmetadata',
        () => {
          animFrameRef.current = requestAnimationFrame(loop)
        },
        { once: true }
      )
    }

    return () => {
      runningRef.current = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  const drawDetections = (detections: DetectionResult[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    detections.forEach(({ box, label, score }) => {
      const [x1, y1, x2, y2] = box
      const width = x2 - x1
      const height = y2 - y1

      ctx.strokeStyle = 'lime'
      ctx.lineWidth = 2
      ctx.strokeRect(x1, y1, width, height)

      ctx.fillStyle = 'lime'
      const text = `${label} (${score.toFixed(2)})`
      const textWidth = ctx.measureText(text).width
      ctx.fillRect(x1, y1 - 20, textWidth + 10, 20)

      ctx.fillStyle = 'black'
      ctx.font = '16px sans-serif'
      ctx.fillText(text, x1 + 5, y1 - 5)
    })
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Monitor</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Status:
            <Badge
              variant={
                wsRef.current?.readyState === 1 ? 'default' : 'destructive'
              }
            >
              {status}
            </Badge>
          </p>
        </div>
        <div className="bg-muted rounded-md px-3 py-1 font-mono text-sm">
          Last Activity:{' '}
          {lastDetectionTime
            ? new Date(lastDetectionTime).toLocaleTimeString()
            : '--:--:--'}
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-black shadow-2xl">
        <div className="relative aspect-[4/3] w-full max-w-[800px] bg-gray-900">
          <video
            ref={videoRef}
            width={VIDEO_WIDTH}
            height={VIDEO_HEIGHT}
            className="h-full w-full object-contain"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            width={VIDEO_WIDTH}
            height={VIDEO_HEIGHT}
            className="pointer-events-none absolute top-0 left-0 h-full w-full object-contain"
          />
        </div>
      </div>
    </div>
  )
}

export default StreamPage
