import { useState } from 'react'
import { X } from 'lucide-react'
import type { ManualProductFormData } from '../../types'

interface AddProductModalProps {
  onClose: () => void
  onSubmit: (data: ManualProductFormData) => void
}

export function AddProductModal({ onClose, onSubmit }: AddProductModalProps) {
  const [productName, setProductName] = useState('')
  const [videosFilmed, setVideosFilmed] = useState('0')
  const [firstVideoDeadline, setFirstVideoDeadline] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = productName.trim()
    if (!trimmed) return

    onSubmit({
      productName: trimmed,
      commission: 0,
      tier: 'Test',
      videosFilmed: Math.max(0, parseInt(videosFilmed, 10) || 0),
      ...(firstVideoDeadline.trim()
        ? { firstVideoDeadline: firstVideoDeadline.trim() }
        : {}),
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
              Saved to your durable catalog. Zero-sales products enter as Test (6-video trial).
            </p>
          </label>

          <label className="block">
            <span className="label-caps mb-3 block">Videos Already Filmed</span>
            <input
              type="number"
              min={0}
              value={videosFilmed}
              onChange={(e) => setVideosFilmed(e.target.value)}
              className="input-field w-full px-3 py-3"
            />
          </label>

          <label className="block">
            <span className="label-caps mb-3 block">
              First-video deadline{' '}
              <span className="normal-case tracking-normal text-stone">(optional)</span>
            </span>
            <input
              type="date"
              value={firstVideoDeadline}
              onChange={(e) => setFirstVideoDeadline(e.target.value)}
              className="input-field w-full px-3 py-3"
            />
            <p className="mt-2 font-body text-xs text-stone">
              Applies only to the first trial video. Videos 2–6 stay on the normal 6-video Test
              path. Retainers belong on the Retainers tab.
            </p>
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
