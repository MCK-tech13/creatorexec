import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, LoaderCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { ProductScoutMetrics, ProductScoutRecent7dMetrics } from '../../types/productScout'
import {
  EMPTY_PRODUCT_SCOUT_METRICS,
  EMPTY_PRODUCT_SCOUT_RECENT_7D,
} from '../../lib/productScout/formDefaults'
import {
  extractScreenshotMetrics,
  fileToDownsizedDataUrl,
  mergeExtractedIntoMetrics,
  mergeExtractedIntoRecent7d,
  type ExtractConfidence,
  type ProductScoutOcrPeriod,
} from '../../lib/productScout/extractScreenshot'
import { hasProductScoutData, scoreProductScout } from '../../lib/productScout/scorer'
import {
  ensureClientVersionCurrent,
  registerBeforeClientReload,
} from '../../lib/version/clientVersionGuard'
import { clearClientFormDirty, markClientFormDirty } from '../../lib/version/formDirtyRegistry'
import { clearProductScoutDraft, saveProductScoutDraft } from '../../lib/version/productScoutDraft'
import { ProductScoutResults } from './ProductScoutResults'
import { ProductScoutWalkthrough } from './ProductScoutWalkthrough'

const METRIC_FIELDS: {
  key: keyof Omit<ProductScoutMetrics, 'recent7d'>
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

const RECENT_7D_FIELDS: {
  key: keyof ProductScoutRecent7dMetrics
  label: string
  valuePlaceholder: string
  deltaPlaceholder: string
  hint: string
}[] = [
  {
    key: 'orders',
    label: 'Orders (7-day)',
    valuePlaceholder: '8.2K',
    deltaPlaceholder: 'e.g. -1.1K',
    hint: 'Optional — 7-day orders and change from TikTok Product trends',
  },
  {
    key: 'atcUsers',
    label: 'Add-to-cart users (7-day)',
    valuePlaceholder: '22K',
    deltaPlaceholder: 'e.g. -3.4K',
    hint: 'Optional — 7-day ATC users and change',
  },
  {
    key: 'creators',
    label: 'Number of creators (7-day)',
    valuePlaceholder: '1.2K',
    deltaPlaceholder: 'e.g. +180',
    hint: 'Optional — 7-day creator count and change (flags late-trend creator influx)',
  },
]

interface ProductScoutFormProps {
  initialName?: string
  initialMetrics?: ProductScoutMetrics
  submitLabel: string
  formMode?: 'new' | 'edit'
  editId?: string
  onSubmit: (productName: string, metrics: ProductScoutMetrics) => void | Promise<void>
  onCancel: () => void
}

const FORM_ID = 'product-scout'

function recent7dEqual(
  a: ProductScoutRecent7dMetrics | undefined,
  b: ProductScoutRecent7dMetrics | undefined,
): boolean {
  const left = a ?? EMPTY_PRODUCT_SCOUT_RECENT_7D
  const right = b ?? EMPTY_PRODUCT_SCOUT_RECENT_7D
  return (['orders', 'atcUsers', 'creators'] as const).every(
    (key) => left[key].value === right[key].value && left[key].delta === right[key].delta,
  )
}

function metricsEqual(a: ProductScoutMetrics, b: ProductScoutMetrics): boolean {
  const core = (['orders', 'ctr', 'creators', 'atcUsers'] as const).every(
    (key) => a[key].value === b[key].value && a[key].delta === b[key].delta,
  )
  return core && recent7dEqual(a.recent7d, b.recent7d)
}

function pruneEmptyRecent7d(metrics: ProductScoutMetrics): ProductScoutMetrics {
  const recent = metrics.recent7d
  if (!recent) {
    const { recent7d: _drop, ...rest } = metrics
    return rest
  }
  const hasAny =
    recent.orders.value.trim() !== '' ||
    recent.orders.delta.trim() !== '' ||
    recent.atcUsers.value.trim() !== '' ||
    recent.atcUsers.delta.trim() !== '' ||
    recent.creators.value.trim() !== '' ||
    recent.creators.delta.trim() !== ''
  if (!hasAny) {
    const { recent7d: _drop, ...rest } = metrics
    return rest
  }
  return metrics
}

export function ProductScoutForm({
  initialName = '',
  initialMetrics = EMPTY_PRODUCT_SCOUT_METRICS,
  submitLabel,
  formMode = 'new',
  editId,
  onSubmit,
  onCancel,
}: ProductScoutFormProps) {
  const { session } = useAuth()
  const fileInput30Ref = useRef<HTMLInputElement>(null)
  const fileInput7Ref = useRef<HTMLInputElement>(null)
  const [productName, setProductName] = useState(initialName)
  const [metrics, setMetrics] = useState<ProductScoutMetrics>(initialMetrics)
  const [nameError, setNameError] = useState<string | null>(null)
  const [ocrReadingPeriod, setOcrReadingPeriod] = useState<ProductScoutOcrPeriod | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrConfidence, setOcrConfidence] = useState<ExtractConfidence | null>(null)
  const [ocrFileName, setOcrFileName] = useState<string | null>(null)
  const [versionChecking, setVersionChecking] = useState(false)

  const ocrReading = ocrReadingPeriod !== null

  const previewResult = useMemo(() => {
    if (!hasProductScoutData(metrics)) return null
    return scoreProductScout(metrics)
  }, [metrics])

  const canSubmit = previewResult !== null && !versionChecking

  const isDirty =
    productName.trim() !== initialName.trim() || !metricsEqual(metrics, initialMetrics)

  const hasUnsavedWork = isDirty || ocrReading

  const persistDraft = () => {
    saveProductScoutDraft({
      productName,
      metrics,
      mode: formMode,
      editId,
    })
  }

  useEffect(() => {
    if (hasUnsavedWork) {
      markClientFormDirty(FORM_ID)
    } else {
      clearClientFormDirty(FORM_ID)
    }
    return () => {
      clearClientFormDirty(FORM_ID)
    }
  }, [hasUnsavedWork])

  useEffect(() => {
    if (!hasUnsavedWork) return
    const timer = window.setTimeout(() => {
      persistDraft()
    }, 250)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist latest fields on dirty changes
  }, [hasUnsavedWork, productName, metrics, formMode, editId])

  useEffect(() => {
    const flushIfNeeded = () => {
      if (!hasUnsavedWork) return
      persistDraft()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushIfNeeded()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flushIfNeeded)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flushIfNeeded)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedWork, productName, metrics, formMode, editId])

  useEffect(() => {
    return registerBeforeClientReload(() => {
      if (hasUnsavedWork) persistDraft()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedWork, productName, metrics, formMode, editId])

  const updateMetric = (
    key: keyof Omit<ProductScoutMetrics, 'recent7d'>,
    field: 'value' | 'delta',
    next: string,
  ) => {
    setMetrics((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: next,
      },
    }))
  }

  const updateRecent7d = (
    key: keyof ProductScoutRecent7dMetrics,
    field: 'value' | 'delta',
    next: string,
  ) => {
    setMetrics((prev) => {
      const recent = prev.recent7d ?? { ...EMPTY_PRODUCT_SCOUT_RECENT_7D }
      return {
        ...prev,
        recent7d: {
          ...recent,
          [key]: {
            ...recent[key],
            [field]: next,
          },
        },
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!previewResult || versionChecking) return

    const trimmedName = productName.trim()
    if (!trimmedName) {
      setNameError('Enter a product name to add this to your list.')
      return
    }

    setNameError(null)
    setVersionChecking(true)
    const metricsToSave = pruneEmptyRecent7d(metrics)
    try {
      const current = await ensureClientVersionCurrent({
        beforeReload: () => {
          saveProductScoutDraft({
            productName: trimmedName,
            metrics: metricsToSave,
            mode: formMode,
            editId,
          })
          clearClientFormDirty(FORM_ID)
        },
      })
      if (!current) return
      clearClientFormDirty(FORM_ID)
      clearProductScoutDraft()
      await onSubmit(trimmedName, metricsToSave)
    } finally {
      setVersionChecking(false)
    }
  }

  const handleCancel = () => {
    clearClientFormDirty(FORM_ID)
    clearProductScoutDraft()
    onCancel()
  }

  const handleScreenshotSelected = async (
    period: ProductScoutOcrPeriod,
    file: File | undefined,
  ) => {
    if (!file) return

    setOcrError(null)
    setOcrConfidence(null)
    setOcrFileName(file.name)

    const accessToken = session?.access_token
    if (!accessToken) {
      setOcrError('Sign in again to upload a screenshot, or enter the numbers manually.')
      return
    }

    setOcrReadingPeriod(period)
    try {
      const imageDataUrl = await fileToDownsizedDataUrl(file)
      const result = await extractScreenshotMetrics(accessToken, imageDataUrl, period)
      setMetrics((prev) =>
        period === '7'
          ? mergeExtractedIntoRecent7d(prev, result.metrics)
          : mergeExtractedIntoMetrics(prev, result.metrics),
      )
      setOcrConfidence(result.metrics.confidence)
    } catch (error) {
      setOcrConfidence(null)
      setOcrError(
        error instanceof Error
          ? error.message
          : 'Could not read that screenshot. Enter the numbers manually instead.',
      )
    } finally {
      setOcrReadingPeriod(null)
      if (period === '7' && fileInput7Ref.current) fileInput7Ref.current.value = ''
      if (period === '30' && fileInput30Ref.current) fileInput30Ref.current.value = ''
    }
  }

  const recent7d = metrics.recent7d ?? EMPTY_PRODUCT_SCOUT_RECENT_7D

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
                <p className="label-caps mb-1">TikTok Product trends (30-day)</p>
                <p className="font-body text-sm text-stone">
                  Enter the 30-day value and delta exactly as shown on TikTok Shop&apos;s product
                  promotion screen — or upload a screenshot to pre-fill the values.
                </p>
              </div>
              <div className="shrink-0">
                <input
                  ref={fileInput30Ref}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => void handleScreenshotSelected('30', e.target.files?.[0])}
                  disabled={ocrReading}
                />
                <button
                  type="button"
                  className="btn-outline inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm sm:w-auto"
                  onClick={() => fileInput30Ref.current?.click()}
                  disabled={ocrReading}
                >
                  {ocrReadingPeriod === '30' ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus className="h-4 w-4" aria-hidden />
                  )}
                  {ocrReadingPeriod === '30' ? 'Reading…' : 'Upload 30-day screenshot'}
                </button>
              </div>
            </div>

            {ocrReading && (
              <div
                className="border border-border-warm bg-cream/40 px-4 py-3 font-body text-sm text-ink"
                role="status"
                aria-live="polite"
              >
                Reading your {ocrReadingPeriod === '7' ? '7-day' : '30-day'} screenshot…
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

            <div className="border-t border-border-warm pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="label-caps mb-1">7-day trends (optional)</p>
                  <p className="font-body text-sm text-stone">
                    Add a 7-day screenshot if you have one. Used only to flag recent cooling when
                    30-day orders are still growing — skip this and scoring stays the same.
                  </p>
                </div>
                <div className="shrink-0">
                  <input
                    ref={fileInput7Ref}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => void handleScreenshotSelected('7', e.target.files?.[0])}
                    disabled={ocrReading}
                  />
                  <button
                    type="button"
                    className="btn-outline inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm sm:w-auto"
                    onClick={() => fileInput7Ref.current?.click()}
                    disabled={ocrReading}
                  >
                    {ocrReadingPeriod === '7' ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <ImagePlus className="h-4 w-4" aria-hidden />
                    )}
                    {ocrReadingPeriod === '7' ? 'Reading…' : 'Upload 7-day screenshot'}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                {RECENT_7D_FIELDS.map((field) => (
                  <fieldset key={`7d-${field.key}`} className="border border-border-warm p-5">
                    <legend className="px-1 font-body text-sm font-semibold text-ink">
                      {field.label}
                    </legend>
                    <p className="mb-4 font-body text-xs text-stone">{field.hint}</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="label-caps mb-2 block">Value</span>
                        <input
                          type="text"
                          value={recent7d[field.key].value}
                          onChange={(e) => updateRecent7d(field.key, 'value', e.target.value)}
                          className="input-field w-full px-3 py-3"
                          placeholder={field.valuePlaceholder}
                          disabled={ocrReading}
                        />
                      </label>
                      <label className="block">
                        <span className="label-caps mb-2 block">Delta</span>
                        <input
                          type="text"
                          value={recent7d[field.key].delta}
                          onChange={(e) => updateRecent7d(field.key, 'delta', e.target.value)}
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
      </div>

      {previewResult && (
        <div>
          <p className="label-caps mb-4">Live preview</p>
          <ProductScoutResults result={previewResult} />
        </div>
      )}

      <div className="flex flex-col gap-px sm:flex-row">
        <button
          type="button"
          onClick={handleCancel}
          className="btn-outline flex-1 py-3"
          disabled={ocrReading || versionChecking}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit || ocrReading}
          className="btn-primary flex-1 py-3 disabled:cursor-not-allowed"
        >
          {versionChecking ? 'Checking for updates…' : submitLabel}
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
