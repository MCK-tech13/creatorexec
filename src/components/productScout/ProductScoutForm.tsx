import { useMemo, useRef, useState } from 'react'
import { ImagePlus, LoaderCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { ProductScoutMetrics } from '../../types/productScout'
import { EMPTY_PRODUCT_SCOUT_METRICS } from '../../lib/productScout/formDefaults'
import {
  extractScreenshotMetrics,
  fileToDownsizedDataUrl,
  mergeExtractedIntoMetrics,
  type ExtractConfidence,
} from '../../lib/productScout/extractScreenshot'
import { hasProductScoutData, scoreProductScout } from '../../lib/productScout/scorer'
import { ProductScoutResults } from './ProductScoutResults'
import { ProductScoutWalkthrough } from './ProductScoutWalkthrough'

const METRIC_FIELDS: {
  key: keyof ProductScoutMetrics
  label: string
  valuePlaceholder: string
  deltaPlaceholder: string
  hint: string
}[] = [
  {
    key: 'orders',
    label: 'Orders',
    valuePlaceholder: '24.1K',
    deltaPlaceholder: 'e.g. +190',
    hint: '30-day orders and change from TikTok Product trends',
  },
  {
    key: 'ctr',
    label: 'CTR',
    valuePlaceholder: '3.5',
    deltaPlaceholder: 'e.g. +1.8',
    hint: 'Click-through rate and 30-day delta',
  },
  {
    key: 'creators',
    label: 'Number of creators',
    valuePlaceholder: '8.8K',
    deltaPlaceholder: 'e.g. +16',
    hint: 'How many creators are promoting this product',
  },
  {
    key: 'atcUsers',
    label: 'Add-to-cart users',
    valuePlaceholder: '74.1K',
    deltaPlaceholder: 'e.g. +504',
    hint: 'Users who added to cart in the last 30 days',
  },
]

interface ProductScoutFormProps {
  initialName?: string
  initialMetrics?: ProductScoutMetrics
  submitLabel: string
  onSubmit: (productName: string, metrics: ProductScoutMetrics) => void
  onCancel: () => void
}

export function ProductScoutForm({
  initialName = '',
  initialMetrics = EMPTY_PRODUCT_SCOUT_METRICS,
  submitLabel,
  onSubmit,
  onCancel,
}: ProductScoutFormProps) {
  const { session } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [productName, setProductName] = useState(initialName)
  const [metrics, setMetrics] = useState<ProductScoutMetrics>(initialMetrics)
  const [nameError, setNameError] = useState<string | null>(null)
  const [ocrReading, setOcrReading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrConfidence, setOcrConfidence] = useState<ExtractConfidence | null>(null)
  const [ocrFileName, setOcrFileName] = useState<string | null>(null)

  const previewResult = useMemo(() => {
    if (!hasProductScoutData(metrics)) return null
    return scoreProductScout(metrics)
  }, [metrics])

  const canSubmit = previewResult !== null

  const updateMetric = (key: keyof ProductScoutMetrics, field: 'value' | 'delta', next: string) => {
    setMetrics((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: next,
      },
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    const trimmedName = productName.trim()
    if (!trimmedName) {
      setNameError('Enter a product name to add this to your list.')
      return
    }

    setNameError(null)
    onSubmit(trimmedName, metrics)
  }

  const handleScreenshotSelected = async (file: File | undefined) => {
    if (!file) return

    setOcrError(null)
    setOcrConfidence(null)
    setOcrFileName(file.name)

    const accessToken = session?.access_token
    if (!accessToken) {
      setOcrError('Sign in again to upload a screenshot, or enter the numbers manually.')
      return
    }

    setOcrReading(true)
    try {
      const imageDataUrl = await fileToDownsizedDataUrl(file)
      const result = await extractScreenshotMetrics(accessToken, imageDataUrl)
      setMetrics((prev) => mergeExtractedIntoMetrics(prev, result.metrics))
      setOcrConfidence(result.metrics.confidence)
    } catch (error) {
      setOcrConfidence(null)
      setOcrError(
        error instanceof Error
          ? error.message
          : 'Could not read that screenshot. Enter the numbers manually instead.',
      )
    } finally {
      setOcrReading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <label className="block">
        <span className="label-caps mb-3 block">Product name</span>
        <input
          type="text"
          value={productName}
          onChange={(e) => {
            setProductName(e.target.value)
            if (nameError) setNameError(null)
          }}
          className={`input-field w-full px-3 py-3 ${nameError ? 'border-terracotta ring-1 ring-terracotta' : ''}`}
          placeholder="e.g. Vitamin C serum — GlowLab"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'product-name-error' : undefined}
        />
        {nameError && (
          <p id="product-name-error" className="mt-2 font-body text-sm text-stone">
            {nameError}
          </p>
        )}
      </label>

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-start xl:gap-8">
          <ProductScoutWalkthrough />
          <div className="min-w-0 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="label-caps mb-1">TikTok Product trends</p>
                <p className="font-body text-sm text-stone">
                  Enter the 30-day value and delta exactly as shown on TikTok Shop&apos;s product
                  promotion screen — or upload a screenshot to pre-fill the values.
                </p>
              </div>
              <div className="shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => void handleScreenshotSelected(e.target.files?.[0])}
                  disabled={ocrReading}
                />
                <button
                  type="button"
                  className="btn-outline inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm sm:w-auto"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={ocrReading}
                >
                  {ocrReading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus className="h-4 w-4" aria-hidden />
                  )}
                  {ocrReading ? 'Reading…' : 'Upload screenshot'}
                </button>
              </div>
            </div>

            {ocrReading && (
              <div
                className="border border-border-warm bg-cream/40 px-4 py-3 font-body text-sm text-ink"
                role="status"
                aria-live="polite"
              >
                Reading your screenshot…
                {ocrFileName ? (
                  <span className="mt-1 block text-xs text-stone">{ocrFileName}</span>
                ) : null}
              </div>
            )}

            {ocrError && !ocrReading && (
              <div
                className="border border-terracotta/40 bg-terracotta-tint px-4 py-3 font-body text-sm text-ink"
                role="alert"
              >
                <p className="font-semibold">Couldn&apos;t read that screenshot</p>
                <p className="mt-1 text-stone">{ocrError}</p>
                <p className="mt-2 text-stone">
                  You can still enter the numbers manually below — nothing was submitted.
                </p>
              </div>
            )}

            {ocrConfidence === 'low' && !ocrReading && !ocrError && (
              <div
                className="border border-terracotta/40 bg-terracotta-tint px-4 py-3 font-body text-sm text-ink"
                role="status"
              >
                Double-check these numbers — the screenshot was hard to read. Values are
                pre-filled only; they won&apos;t be scored until you review and save.
              </div>
            )}

            {ocrConfidence && ocrConfidence !== 'low' && !ocrReading && !ocrError && (
              <p className="font-body text-xs text-stone">
                Pre-filled from screenshot ({ocrConfidence} confidence), including deltas when
                readable. Review everything, then save when it looks right.
              </p>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              {METRIC_FIELDS.map((field) => (
                <fieldset key={field.key} className="border border-border-warm p-5">
                  <legend className="px-1 font-body text-sm font-semibold text-ink">{field.label}</legend>
                  <p className="mb-4 font-body text-xs text-stone">{field.hint}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="label-caps mb-2 block">Value</span>
                      <input
                        type="text"
                        value={metrics[field.key].value}
                        onChange={(e) => updateMetric(field.key, 'value', e.target.value)}
                        className="input-field w-full px-3 py-3"
                        placeholder={field.valuePlaceholder}
                        disabled={ocrReading}
                      />
                    </label>
                    <label className="block">
                      <span className="label-caps mb-2 block">Delta</span>
                      <input
                        type="text"
                        value={metrics[field.key].delta}
                        onChange={(e) => updateMetric(field.key, 'delta', e.target.value)}
                        className="input-field w-full px-3 py-3"
                        placeholder={field.deltaPlaceholder}
                        disabled={ocrReading}
                      />
                    </label>
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        </div>
      </div>

      {previewResult && (
        <div>
          <p className="label-caps mb-4">Live preview</p>
          <ProductScoutResults result={previewResult} />
        </div>
      )}

      <div className="flex flex-col gap-px sm:flex-row">
        <button type="button" onClick={onCancel} className="btn-outline flex-1 py-3" disabled={ocrReading}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit || ocrReading}
          className="btn-primary flex-1 py-3 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </button>
      </div>
      {canSubmit && !productName.trim() && (
        <p className="font-body text-xs text-stone">
          Add a product name above, then click {submitLabel}.
        </p>
      )}
    </form>
  )
}
