import type { ProductScoutMetrics } from '../../types/productScout'
import { formatTrendNumber } from './metricParser'
import { EMPTY_PRODUCT_SCOUT_METRICS } from './formDefaults'

export type ExtractConfidence = 'low' | 'medium' | 'high'

export interface ExtractedTrendMetrics {
  orders: number | null
  ctr: number | null
  creators: number | null
  atc: number | null
  confidence: ExtractConfidence
}

export interface ExtractScreenshotResult {
  metrics: ExtractedTrendMetrics
  meta?: {
    width: number | null
    height: number | null
    originalWidth: number | null
    originalHeight: number | null
  }
}

function formatMetricValue(value: number | null, kind: 'orders' | 'ctr' | 'creators' | 'atc'): string {
  if (value === null) return ''
  if (kind === 'ctr') {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
  }
  return formatTrendNumber(value)
}

/** Map Claude's numeric extraction into Product Scout form string fields (values only; deltas left blank). */
export function extractedMetricsToFormMetrics(
  extracted: ExtractedTrendMetrics,
): ProductScoutMetrics {
  return {
    orders: { value: formatMetricValue(extracted.orders, 'orders'), delta: '' },
    ctr: { value: formatMetricValue(extracted.ctr, 'ctr'), delta: '' },
    creators: { value: formatMetricValue(extracted.creators, 'creators'), delta: '' },
    atcUsers: { value: formatMetricValue(extracted.atc, 'atc'), delta: '' },
  }
}

export function mergeExtractedIntoMetrics(
  current: ProductScoutMetrics,
  extracted: ExtractedTrendMetrics,
): ProductScoutMetrics {
  const mapped = extractedMetricsToFormMetrics(extracted)
  return {
    orders: {
      value: mapped.orders.value || current.orders.value,
      delta: current.orders.delta,
    },
    ctr: {
      value: mapped.ctr.value || current.ctr.value,
      delta: current.ctr.delta,
    },
    creators: {
      value: mapped.creators.value || current.creators.value,
      delta: current.creators.delta,
    },
    atcUsers: {
      value: mapped.atcUsers.value || current.atcUsers.value,
      delta: current.atcUsers.delta,
    },
  }
}

const MAX_LONG_EDGE = 1024
const JPEG_QUALITY = 0.82

/** Client-side downsize before upload (server also downsizes as a safety net). */
export async function fileToDownsizedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image screenshot (PNG or JPEG).')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const longEdge = Math.max(img.naturalWidth, img.naturalHeight)
    const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process that image in this browser.')
    ctx.drawImage(img, 0, 0, width, height)

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not open that image. Try another screenshot.'))
    img.src = src
  })
}

export async function extractScreenshotMetrics(
  accessToken: string,
  imageDataUrl: string,
): Promise<ExtractScreenshotResult> {
  const response = await fetch('/api/product-scout/extract-screenshot', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageDataUrl }),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    metrics?: ExtractedTrendMetrics
    meta?: ExtractScreenshotResult['meta']
    error?: string
  }

  if (!response.ok || !payload.metrics) {
    throw new Error(
      payload.error ??
        'Could not read that screenshot. Enter the numbers manually instead.',
    )
  }

  return { metrics: payload.metrics, meta: payload.meta }
}

export { EMPTY_PRODUCT_SCOUT_METRICS }
