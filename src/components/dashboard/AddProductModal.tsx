import { useState } from 'react'
import { X } from 'lucide-react'
import type { ManualProductFormData, ManualTier } from '../../types'

interface AddProductModalProps {
  onClose: () => void
  onSubmit: (data: ManualProductFormData) => void
}

const TIERS: ManualTier[] = ['Anchor', 'Rising', 'Test']

export function AddProductModal({ onClose, onSubmit }: AddProductModalProps) {
  const [productName, setProductName] = useState('')
  const [commission, setCommission] = useState('')
  const [tier, setTier] = useState<ManualTier>('Test')
  const [videosFilmed, setVideosFilmed] = useState('0')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = productName.trim()
    if (!trimmed) return

    onSubmit({
      productName: trimmed,
      commission: Math.max(0, parseFloat(commission) || 0),
      tier,
      videosFilmed: Math.max(0, parseInt(videosFilmed, 10) || 0),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4 backdrop-blur-sm">
      <div className="card-panel w-full max-w-md p-8">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-ink">Add Product Manually</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-stone transition hover:bg-cream hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block font-sans text-sm font-medium text-stone">
              Product Name
            </span>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required
              className="input-field w-full px-3 py-2.5"
              placeholder="Gifted sample, new launch, etc."
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-sans text-sm font-medium text-stone">
              Commission Amount ($)
            </span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className="input-field w-full px-3 py-2.5"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-sans text-sm font-medium text-stone">Tier</span>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as ManualTier)}
              className="input-field w-full px-3 py-2.5"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block font-sans text-sm font-medium text-stone">
              Videos Filmed
            </span>
            <input
              type="number"
              min={0}
              value={videosFilmed}
              onChange={(e) => setVideosFilmed(e.target.value)}
              className="input-field w-full px-3 py-2.5"
            />
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1 py-2.5 text-sm">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 py-2.5 text-sm">
              Add Product
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
