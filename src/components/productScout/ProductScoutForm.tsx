import { useMemo, useState } from 'react'
import type { ProductScoutMetrics } from '../../types/productScout'
import { EMPTY_PRODUCT_SCOUT_METRICS } from '../../lib/productScout/formDefaults'
import { isValidProductScoutMetrics, scoreProductScout } from '../../lib/productScout/scorer'
import { ProductScoutResults } from './ProductScoutResults'

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
    deltaPlaceholder: '+3.6K',
    hint: '30-day orders and change from TikTok Product trends',
  },
  {
    key: 'ctr',
    label: 'CTR',
    valuePlaceholder: '3.5%',
    deltaPlaceholder: '-0.5%',
    hint: 'Click-through rate and 30-day delta',
  },
  {
    key: 'creators',
    label: 'Number of creators',
    valuePlaceholder: '8.8K',
    deltaPlaceholder: '+1.1K',
    hint: 'How many creators are promoting this product',
  },
  {
    key: 'atcUsers',
    label: 'Add-to-cart users',
    valuePlaceholder: '74.1K',
    deltaPlaceholder: '+13.2K',
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
  const [productName, setProductName] = useState(initialName)
  const [metrics, setMetrics] = useState<ProductScoutMetrics>(initialMetrics)

  const previewResult = useMemo(() => {
    if (!isValidProductScoutMetrics(metrics)) return null
    return scoreProductScout(metrics)
  }, [metrics])

  const canSubmit = productName.trim().length > 0 && previewResult !== null

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
    onSubmit(productName.trim(), metrics)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <label className="block">
        <span className="label-caps mb-3 block">Product name</span>
        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          required
          className="input-field w-full px-3 py-3"
          placeholder="e.g. Vitamin C serum — GlowLab"
        />
      </label>

      <div className="space-y-6">
        <div>
          <p className="label-caps mb-1">TikTok Product trends</p>
          <p className="font-body text-sm text-stone">
            Enter the 30-day value and delta exactly as shown on TikTok Shop&apos;s product
            promotion screen.
          </p>
        </div>

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
                />
              </label>
            </div>
          </fieldset>
        ))}
      </div>

      {previewResult && (
        <div>
          <p className="label-caps mb-4">Live preview</p>
          <ProductScoutResults result={previewResult} />
        </div>
      )}

      <div className="flex flex-col gap-px sm:flex-row">
        <button type="button" onClick={onCancel} className="btn-outline flex-1 py-3">
          Cancel
        </button>
        <button type="submit" disabled={!canSubmit} className="btn-primary flex-1 py-3">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
