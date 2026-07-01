import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { SampleProduct, SampleProductType } from '../../types'
import { EditorialMark } from '../ui/EditorialMark'
import { ProductChoosingTips } from './ProductChoosingTips'

interface SampleModeScreenProps {
  initialProducts?: SampleProduct[]
  onBuildSchedule: (products: SampleProduct[]) => void
  onEnterUpload?: () => void
  onEnterMomentum?: () => void
}

const TYPE_OPTIONS: { value: SampleProductType; label: string }[] = [
  { value: 'sample', label: 'Sample' },
  { value: 'favorite', label: 'Favorite' },
]

function formatDisplayDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function SampleModeScreen({
  initialProducts = [],
  onBuildSchedule,
  onEnterUpload,
  onEnterMomentum,
}: SampleModeScreenProps) {
  const [products, setProducts] = useState<SampleProduct[]>(initialProducts)
  const [productName, setProductName] = useState('')
  const [brand, setBrand] = useState('')
  const [dateReceived, setDateReceived] = useState('')
  const [type, setType] = useState<SampleProductType>('sample')

  const canAdd = productName.trim().length > 0 && dateReceived.length > 0

  const handleAdd = () => {
    if (!canAdd) return
    setProducts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productName: productName.trim(),
        brand: brand.trim(),
        dateReceived,
        type,
      },
    ])
    setProductName('')
    setBrand('')
    setDateReceived('')
    setType('sample')
  }

  const handleRemove = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="mx-auto w-full max-w-xl fade-in">
      <div className="mb-5 flex justify-center">
        <EditorialMark />
      </div>

      <h1 className="font-display text-center text-3xl font-bold text-ink md:text-4xl">
        Add your samples and favorites
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-center font-body text-base text-stone">
        Add your current samples and any products you love filming — we&apos;ll build your sprint
        schedule instantly.
      </p>

      <div className="mt-8">
        <ProductChoosingTips />
      </div>

      <div className="mt-8 space-y-5 border border-border-warm p-6">
        <div>
          <label htmlFor="sample-product-name" className="label-caps mb-2 block">
            Product Name
          </label>
          <input
            id="sample-product-name"
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="input-field w-full px-4 py-3"
            placeholder="e.g. Hydrating Face Serum"
          />
        </div>

        <div>
          <label htmlFor="sample-brand" className="label-caps mb-2 block">
            Brand
          </label>
          <input
            id="sample-brand"
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="input-field w-full px-4 py-3"
            placeholder="e.g. GlowLab"
          />
        </div>

        <div>
          <label htmlFor="sample-date" className="label-caps mb-2 block">
            Date Received
          </label>
          <input
            id="sample-date"
            type="date"
            value={dateReceived}
            onChange={(e) => setDateReceived(e.target.value)}
            className="input-field w-full px-4 py-3"
          />
        </div>

        <div>
          <span className="label-caps mb-2 block">Type</span>
          <div className="grid grid-cols-2 gap-px bg-border-warm">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`py-3 font-body text-sm font-medium transition ${
                  type === opt.value
                    ? 'bg-emerald text-white'
                    : 'bg-white text-stone hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="btn-outline w-full py-3 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add Product
        </button>
      </div>

      {products.length > 0 && (
        <ul className="mt-6 divide-y divide-border-warm border border-border-warm">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex items-center gap-4 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-medium text-ink">{product.productName}</p>
                <p className="mt-0.5 font-body text-sm text-stone">
                  {[product.brand, formatDisplayDate(product.dateReceived)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <span
                className={`badge-compact shrink-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  product.type === 'sample'
                    ? 'bg-blush text-white'
                    : 'bg-emerald text-white'
                }`}
              >
                {product.type === 'sample' ? 'Sample' : 'Favorite'}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(product.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center border border-border-warm text-stone transition hover:border-ink hover:text-ink"
                aria-label={`Remove ${product.productName}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <button
          type="button"
          onClick={() => onBuildSchedule(products)}
          disabled={products.length === 0}
          className="btn-primary w-full py-4"
        >
          Build My Schedule
        </button>
      </div>

      {(onEnterUpload || onEnterMomentum) && (
        <div className="mt-10 space-y-3 border-t border-border-warm pt-8 text-center">
          {onEnterUpload && (
            <button
              type="button"
              onClick={onEnterUpload}
              className="link-elegant block w-full font-body text-sm text-stone"
            >
              Have sales data? Upload your report instead
            </button>
          )}
          {onEnterMomentum && (
            <button
              type="button"
              onClick={onEnterMomentum}
              className="link-elegant block w-full font-body text-sm text-stone"
            >
              Have some sales but not many? Try Momentum Mode instead
            </button>
          )}
        </div>
      )}
    </div>
  )
}
