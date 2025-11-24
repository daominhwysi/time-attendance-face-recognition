// src/lib/stream-utils.ts

export const VIDEO_WIDTH = 640
export const VIDEO_HEIGHT = 480
export const HASH_W = 17
export const HASH_H = 16
export const MEDIUM_W = 112
export const MEDIUM_H = 112
export const HAMMING_THRESHOLD = 5
export const MSE_CONFIRM_THRESHOLD = 5
export const MIN_SEND_INTERVAL_MS = 100

export function createCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function getGrayscaleArrayFromCtx(
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

export function computeDHashBits(
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

export function hammingDistance(a: Uint8Array, b: Uint8Array) {
  let d = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) d++
  }
  return d
}

export function grayscaleMSE(a: Uint8Array, b: Uint8Array) {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const diff = a[i] - b[i]
    s += diff * diff
  }
  return Math.sqrt(s / n)
}
export interface DetectionResult {
  box: [number, number, number, number] // [x1, y1, x2, y2]
  label: string
  score: number
}

export function drawDetections(
  ctx: CanvasRenderingContext2D,
  detections: DetectionResult[],
  width: number,
  height: number,
  scaleFactor: number = 1,
  isMirrored: boolean = false // <--- ADD THIS PARAMETER
) {
  ctx.clearRect(0, 0, width, height)

  // Calculate the multiplier used to scale up from Low Res (Server) to High Res (Screen)
  const multiplier = 1 / scaleFactor

  // Define base sizes (what looks good on a 640px screen)
  const BASE_LINE_WIDTH = 2
  const BASE_FONT_SIZE = 16
  const BASE_PADDING = 5

  // Scale styles dynamically
  const lineWidth = Math.max(BASE_LINE_WIDTH * multiplier, 2)
  const fontSize = Math.max(Math.floor(BASE_FONT_SIZE * multiplier), 12)
  const padding = Math.max(BASE_PADDING * multiplier, 2)

  detections.forEach(({ box, label, score }) => {
    // 1. Scale Coordinates
    let x1 = box[0] * multiplier
    let y1 = box[1] * multiplier
    let x2 = box[2] * multiplier
    let y2 = box[3] * multiplier

    // --- NEW LOGIC: FLIP COORDINATES IF MIRRORED ---
    if (isMirrored) {
      // Invert X axis relative to the canvas width
      const originalX1 = x1
      const originalX2 = x2

      // Swap and invert
      x1 = width - originalX2
      x2 = width - originalX1
    }
    // ------------------------------------------------

    const w = x2 - x1
    const h = y2 - y1

    // 2. Draw Box
    ctx.strokeStyle = 'lime'
    ctx.lineWidth = lineWidth
    ctx.strokeRect(x1, y1, w, h)

    // 3. Prepare Text
    ctx.font = `${fontSize}px sans-serif`
    const text = `${label} (${score.toFixed(2)})`
    const textMetrics = ctx.measureText(text)

    const textWidth = textMetrics.width
    const textHeight = fontSize * 1.2

    // 4. Draw Label Background
    ctx.fillStyle = 'lime'
    ctx.fillRect(
      x1,
      y1 - textHeight - padding,
      textWidth + padding * 2,
      textHeight + padding
    )

    // 5. Draw Text
    ctx.fillStyle = 'black'
    ctx.fillText(text, x1 + padding, y1 - padding)
  })
}
