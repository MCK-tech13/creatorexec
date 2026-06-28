import { useState } from 'react'
import { X } from 'lucide-react'

export interface DeadlineFormData {
  productName: string
  brand: string
  deadlineDate: string
  videosRequired: number
  videosFilmed: number
}

interface AddDeadlineModalProps {
  onClose: () => void
  onSubmit: (data: DeadlineFormData) => void
}

const emptyForm: DeadlineFormData = {
  productName: '',
  brand: '',
  deadlineDate: '',
  videosRequired: 1,
  videosFilmed: 0,
}

export function AddDeadlineModal({ onClose, onSubmit }: AddDeadlineModalProps) {
  const [form, setForm] = useState<DeadlineFormData>(emptyForm)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.productName.trim() || !form.deadlineDate) return
    onSubmit({
      ...form,
      productName: form.productName.trim(),
      brand: form.brand.trim(),
      videosRequired: Math.max(1, form.videosRequired),
      videosFilmed: Math.max(0, form.videosFilmed),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4 backdrop-blur-sm">
      <div className="card-panel w-full max-w-md p-8">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-ink">Add Sample / Deadline</h3>
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
          <div>
            <label className="mb-2 block font-sans text-sm font-medium text-stone">
              Product Name
            </label>
            <input
              required
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              className="input-field w-full px-4 py-2.5"
              placeholder="Peptide Firming Neck Cream"
            />
          </div>
          <div>
            <label className="mb-2 block font-sans text-sm font-medium text-stone">Brand</label>
            <input
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              className="input-field w-full px-4 py-2.5"
              placeholder="Z:SEA"
            />
          </div>
          <div>
            <label className="mb-2 block font-sans text-sm font-medium text-stone">
              Deadline Date
            </label>
            <input
              required
              type="date"
              value={form.deadlineDate}
              onChange={(e) => setForm({ ...form, deadlineDate: e.target.value })}
              className="input-field w-full px-4 py-2.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block font-sans text-sm font-medium text-stone">
                Videos Required
              </label>
              <input
                type="number"
                min={1}
                value={form.videosRequired}
                onChange={(e) =>
                  setForm({ ...form, videosRequired: parseInt(e.target.value, 10) || 1 })
                }
                className="input-field w-full px-4 py-2.5"
              />
            </div>
            <div>
              <label className="mb-2 block font-sans text-sm font-medium text-stone">
                Videos Filmed
              </label>
              <input
                type="number"
                min={0}
                value={form.videosFilmed}
                onChange={(e) =>
                  setForm({ ...form, videosFilmed: parseInt(e.target.value, 10) || 0 })
                }
                className="input-field w-full px-4 py-2.5"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full py-3 text-sm">
            Add to Schedule
          </button>
        </form>
      </div>
    </div>
  )
}
