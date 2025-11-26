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
  viewWidth: number,
  viewHeight: number,
  scaleFactor: number,
  isMirrored: boolean
) {
  // 1. Clear the canvas
  ctx.clearRect(0, 0, viewWidth, viewHeight)

  // --- NEW: DYNAMIC SIZING LOGIC ---
  // We use a reference width (e.g., 640px) to determine how much larger/smaller
  // the current view is.
  const referenceWidth = 640
  const visualRatio = Math.max(0.5, viewWidth / referenceWidth) // Prevent it from getting too small

  // Calculate sizes based on the ratio
  const lineWidth = Math.max(2, 3 * visualRatio) // Min 2px, Base 3px
  const fontSize = Math.floor(Math.max(12, 16 * visualRatio)) // Min 12px, Base 16px
  const fontPadding = Math.floor(4 * visualRatio)

  // Set global styles that don't change per box
  ctx.lineWidth = lineWidth
  ctx.font = `bold ${fontSize}px Courier New`

  detections.forEach((det) => {
    const { box, label, score } = det

    // 2. Scale coordinates back up to Viewport size
    let [x1, y1, x2, y2] = box.map((c) => c / scaleFactor)

    // 3. Handle Mirroring
    if (isMirrored) {
      const tempX1 = x1
      x1 = viewWidth - x2
      x2 = viewWidth - tempX1
    }

    const width = x2 - x1
    const height = y2 - y1

    // Color Logic
    const isUnknown = label.toLowerCase() === 'unknown'
    const color = isUnknown ? '#ff0000' : '#00ff00'
    const textColor = isUnknown ? '#ffffff' : '#000000'

    // 4. Draw Bounding Box (Use dynamic line width)
    ctx.strokeStyle = color
    ctx.strokeRect(x1, y1, width, height)

    // 5. Draw Label Background
    const text = `${label} (${(score * 100).toFixed(0)}%)`
    const textMetrics = ctx.measureText(text)

    // Calculate dynamic text height based on font size + padding
    const textHeight = fontSize + fontPadding * 2

    // Check if label fits above the box, otherwise put it inside/below
    const textY = y1 - textHeight < 0 ? y1 : y1 - textHeight

    ctx.fillStyle = color
    ctx.fillRect(x1, textY, textMetrics.width + fontPadding * 2, textHeight)

    // 6. Draw Label Text
    ctx.fillStyle = textColor
    // Center text vertically within the filled rect
    // (x + padding, y + padding + approx baseline adjustment)
    ctx.fillText(text, x1 + fontPadding, textY + fontSize + fontPadding / 2)
  })
}
