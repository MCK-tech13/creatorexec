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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 p-4">
      <div className="card-panel w-full max-w-md p-10">
        <div className="mb-8 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-ink">Add Product</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone transition hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <label className="block">
            <span className="label-caps mb-3 block">Product Name</span>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required
              className="input-field w-full px-3 py-3"
              placeholder="Gifted sample, new launch, etc."
            />
            <p className="mt-2 font-body text-xs text-stone">
              Saved to your durable catalog. Zero-sales products enter the Test trial (6 videos).
            </p>
          </label>

          <label className="block">
            <span className="label-caps mb-3 block">Commission Amount ($)</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className="input-field w-full px-3 py-3"
            />
          </label>

          <label className="block">
            <span className="label-caps mb-3 block">Tier</span>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as ManualTier)}
              className="input-field w-full px-3 py-3"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label-caps mb-3 block">Videos Filmed</span>
            <input
              type="number"
              min={0}
              value={videosFilmed}
              onChange={(e) => setVideosFilmed(e.target.value)}
              className="input-field w-full px-3 py-3"
            />
          </label>

          <div className="flex gap-px pt-4">
            <button type="button" onClick={onClose} className="btn-outline flex-1 py-3">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 py-3">
              Add Product
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
