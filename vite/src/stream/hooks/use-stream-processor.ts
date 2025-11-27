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

const PROCESSING_FPS = 10 // Tăng nhẹ lên vì đã có flow control lo việc nghẽn mạng
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

  // --- FLOW CONTROL STATE ---
  const isProcessingRef = useRef(false) // Cờ quan trọng nhất: Server có đang bận không?

  const prevHashRef = useRef<Uint8Array | null>(null)
  const prevMediumGrayRef = useRef<Uint8Array | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const lastStateUpdateRef = useRef<number>(0)

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
      isProcessingRef.current = false // Reset trạng thái khi mới kết nối
    }

    ws.onmessage = (event) => {
      // --- UNLOCK HERE ---
      // Khi nhận được kết quả, nghĩa là server đã xử lý xong frame trước
      isProcessingRef.current = false

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
      isProcessingRef.current = false // Reset phòng trường hợp connect lại
    }

    ws.onerror = () => {
      isProcessingRef.current = false // Mở khóa nếu lỗi mạng để thử lại
    }

    return () => {
      if (ws.readyState === 1) ws.close()
    }
  }, [isCameraReady, canvasRef, width, height, scaleFactor, isMirrored])

  // 2. Processing Loop
  useEffect(() => {
    if (!isCameraReady || !videoRef.current) return

    runningRef.current = true

    // Khởi tạo các canvas phụ trợ (off-screen canvas)
    const tinyCanvas = utils.createCanvas(utils.HASH_W, utils.HASH_H)
    const tinyCtx = tinyCanvas.getContext('2d', { willReadFrequently: true })!

    const medCanvas = utils.createCanvas(utils.MEDIUM_W, utils.MEDIUM_H)
    const medCtx = medCanvas.getContext('2d', { willReadFrequently: true })!

    const sendW = Math.floor(width * scaleFactor)
    const sendH = Math.floor(height * scaleFactor)
    const sendCanvas = document.createElement('canvas')
    sendCanvas.width = sendW
    sendCanvas.height = sendH
    const sendCtx = sendCanvas.getContext('2d', {
      willReadFrequently: false,
      alpha: false,
    })!
    sendCtx.imageSmoothingEnabled = false

    let lastSend = 0
    let lastLoopTime = 0

    const loop = () => {
      if (!runningRef.current) return

      // A. Throttle FPS (Client side FPS limit)
      const now = Date.now()
      const elapsed = now - lastLoopTime
      if (elapsed < MIN_TIME_BETWEEN_FRAMES) {
        animFrameRef.current = requestAnimationFrame(loop)
        return
      }
      lastLoopTime = now - (elapsed % MIN_TIME_BETWEEN_FRAMES)

      const video = videoRef.current
      const ws = wsRef.current

      // B. Kiểm tra điều kiện cơ bản
      if (
        !video ||
        !ws ||
        ws.readyState !== WebSocket.OPEN ||
        video.readyState < 2
      ) {
        animFrameRef.current = requestAnimationFrame(loop)
        return
      }

      // --- C. FLOW CONTROL CHECK ---
      // Nếu Server đang bận xử lý frame cũ, ta bỏ qua frame này luôn (Drop Frame)
      // Không cần tính toán Motion Detection làm gì cho tốn CPU
      if (isProcessingRef.current) {
        animFrameRef.current = requestAnimationFrame(loop)
        return
      }

      // --- D. Motion Detection Logic ---
      // (Chỉ chạy khi server đang rảnh)
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

      // Logic check hash và MSE như cũ
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
          // --- E. SEND DATA ---

          // LOCK NGAY LẬP TỨC: Đánh dấu là đang gửi và chờ server
          isProcessingRef.current = true

          lastSend = now
          prevHashRef.current = currHash
          prevMediumGrayRef.current = currMedGray

          sendCtx.drawImage(video, 0, 0, sendW, sendH)

          sendCanvas.toBlob(
            (blob) => {
              // Double check socket trước khi gửi
              if (blob && ws.readyState === WebSocket.OPEN) {
                ws.send(blob)
              } else {
                // Nếu tạo blob xong mà mạng đứt -> Phải mở khóa để thử lại lần sau
                isProcessingRef.current = false
              }
            },
            'image/jpeg',
            0.7
          )

          if (now - lastStateUpdateRef.current > 1000) {
            setLastDetectionTime(now)
            lastStateUpdateRef.current = now
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
