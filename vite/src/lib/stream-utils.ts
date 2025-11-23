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

export interface DetectionResult {
  box: [number, number, number, number]
  label: string
  score: number
}

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

export function drawDetections(
  ctx: CanvasRenderingContext2D,
  detections: DetectionResult[],
  width: number,
  height: number
) {
  ctx.clearRect(0, 0, width, height)

  detections.forEach(({ box, label, score }) => {
    const [x1, y1, x2, y2] = box
    const w = x2 - x1
    const h = y2 - y1

    ctx.strokeStyle = 'lime'
    ctx.lineWidth = 2
    ctx.strokeRect(x1, y1, w, h)

    ctx.fillStyle = 'lime'
    const text = `${label} (${score.toFixed(2)})`
    const textWidth = ctx.measureText(text).width
    ctx.fillRect(x1, y1 - 20, textWidth + 10, 20)

    ctx.fillStyle = 'black'
    ctx.font = '16px sans-serif'
    ctx.fillText(text, x1 + 5, y1 - 5)
  })
}
