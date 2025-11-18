
// // src/stream/page.tsx

// import React, { useRef, useEffect, useState } from 'react'
// import { Link } from 'react-router-dom'

// const VIDEO_WIDTH = 640
// const VIDEO_HEIGHT = 480
// const FRAME_SEND_INTERVAL = 100 // ms, so ~10 FPS

// interface DetectionResult {
//   box: [number, number, number, number] // [x1, y1, x2, y2]
//   label: string
//   score: number
// }

// function StreamPage() {
//   const videoRef = useRef<HTMLVideoElement>(null)
//   const canvasRef = useRef<HTMLCanvasElement>(null)
//   const wsRef = useRef<WebSocket | null>(null)
//   const lastSentTimeRef = useRef(0)
//   const [status, setStatus] = useState('Initializing...')

//   useEffect(() => {
//     // 1. Get camera access
//     async function setupCamera() {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
//         })
//         if (videoRef.current) {
//           videoRef.current.srcObject = stream
//           videoRef.current.play()
//           setStatus('Camera ready. Connecting to server...')
//         }
//       } catch (err) {
//         setStatus('Could not access camera. Please grant permission.')
//         console.error('Error accessing camera:', err)
//       }
//     }

//     setupCamera()

//     // 2. Setup WebSocket connection
//     const ws = new WebSocket('ws://localhost:8000/stream/ws')
//     wsRef.current = ws

//     ws.onopen = () => {
//       setStatus('Connected. Recognition is active.')
//     }

//     ws.onmessage = (event) => {
//       const data = JSON.parse(event.data)
//       if (data.results) {
//         drawDetections(data.results)
//       }
//     }

//     ws.onclose = () => {
//       setStatus('Connection closed. Please refresh the page.')
//     }

//     ws.onerror = (error) => {
//       setStatus('Connection error. Check the console.')
//       console.error('WebSocket Error:', error)
//     }

//     // Cleanup on unmount
//     return () => {
//       ws.close()
//       const stream = videoRef.current?.srcObject as MediaStream | null
//       stream?.getTracks().forEach((track) => track.stop())
//     }
//   }, [])

//   // 3. Send frames to the backend in a loop
//   useEffect(() => {
//     const hiddenCanvas = document.createElement('canvas')
//     hiddenCanvas.width = VIDEO_WIDTH
//     hiddenCanvas.height = VIDEO_HEIGHT
//     const context = hiddenCanvas.getContext('2d')

//     const sendFrame = () => {
//       if (
//         wsRef.current?.readyState === WebSocket.OPEN &&
//         videoRef.current &&
//         context
//       ) {
//         const now = Date.now()
//         if (now - lastSentTimeRef.current > FRAME_SEND_INTERVAL) {
//           lastSentTimeRef.current = now

//           // Draw video frame to hidden canvas
//           context.drawImage(videoRef.current, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)

//           // Get base64 representation and send
//           const dataUrl = hiddenCanvas.toDataURL('image/jpeg', 0.8)
//           wsRef.current.send(dataUrl)
//         }
//       }
//       requestAnimationFrame(sendFrame)
//     }

//     const videoElement = videoRef.current
//     if (videoElement) {
//       videoElement.onloadedmetadata = () => {
//         requestAnimationFrame(sendFrame)
//       }
//     }

//     // Fallback if event doesn't fire
//     const timeoutId = setTimeout(() => requestAnimationFrame(sendFrame), 1000)

//     return () => clearTimeout(timeoutId)
//   }, [])

//   // 4. Draw received detections on the visible canvas
//   const drawDetections = (detections: DetectionResult[]) => {
//     const canvas = canvasRef.current
//     if (!canvas) return
//     const ctx = canvas.getContext('2d')
//     if (!ctx) return

//     // Clear previous drawings
//     ctx.clearRect(0, 0, canvas.width, canvas.height)

//     detections.forEach(({ box, label, score }) => {
//       const [x1, y1, x2, y2] = box
//       const width = x2 - x1
//       const height = y2 - y1

//       // Draw bounding box
//       ctx.strokeStyle = 'lime'
//       ctx.lineWidth = 2
//       ctx.strokeRect(x1, y1, width, height)

//       // Draw label background
//       ctx.fillStyle = 'lime'
//       const text = `${label} (${score.toFixed(2)})`
//       const textWidth = ctx.measureText(text).width
//       ctx.fillRect(x1, y1 - 20, textWidth + 10, 20)

//       // Draw label text
//       ctx.fillStyle = 'black'
//       ctx.font = '16px sans-serif'
//       ctx.fillText(text, x1 + 5, y1 - 5)
//     })
//   }

//   return (
//     <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
//       <h1 className="mb-2 text-3xl font-bold">Live Face Recognition</h1>
//       <p className="mb-4">{status}</p>
//       <div className="w-max-content relative rounded-lg border-4 border-gray-300">
//         <video
//           ref={videoRef}
//           width={VIDEO_WIDTH}
//           height={VIDEO_HEIGHT}
//           className="rounded-md"
//         />
//         <canvas
//           ref={canvasRef}
//           width={VIDEO_WIDTH}
//           height={VIDEO_HEIGHT}
//           className="absolute top-0 left-0"
//         />
//       </div>
//       <Link to="/" className="mt-4">
//         <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
//           Back to Home
//         </button>
//       </Link>
//     </div>
//   )
// }

// export default StreamPage
