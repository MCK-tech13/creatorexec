import type { BrandDeal } from '../../types/pipeline'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

function formatMoney(n?: number): string {
  if (n == null || n <= 0) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDeadline(date?: string): string | null {
  if (!date) return null
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function brandInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

interface DealCardProps {
  deal: BrandDeal
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
}

export function DealCard({ deal, onClick, onDragStart, onDragEnd }: DealCardProps) {
  const deadline = deal.isRetainer
    ? formatDeadline(deal.retainerDeadlineDate)
    : formatDeadline(deal.deadlineDate)
  const [copiedField, setCopiedField] = useState<'link' | 'code' | null>(null)

  const copyValue = async (e: React.MouseEvent, value: string, field: 'link' | 'code') => {
    e.stopPropagation()
    if (!value.trim()) return
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="cursor-pointer border border-border-warm bg-white p-4 transition hover:border-blush/60"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald font-body text-xs font-semibold text-white"
          aria-hidden
        >
          {brandInitial(deal.brandName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-body font-semibold text-ink">{deal.brandName}</p>
          {deal.product && (
            <p className="mt-0.5 truncate font-body text-sm text-stone">{deal.product}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-xs text-stone">
        <span>{formatMoney(deal.compensation)}</span>
        {deadline && <span>Due {deadline}</span>}
        {deal.isRetainer && <span className="text-emerald">Retainer</span>}
      </div>
      {(deal.videoLink || deal.adCode) && (
        <div className="mt-3 space-y-1.5 border-t border-border-warm pt-3">
          {deal.videoLink && (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-body text-xs text-stone">
                {deal.videoLink}
              </span>
              <button
                type="button"
                onClick={(e) => copyValue(e, deal.videoLink!, 'link')}
                className="shrink-0 text-stone hover:text-emerald"
                aria-label="Copy video link"
              >
                {copiedField === 'link' ? (
                  <Check className="h-3.5 w-3.5 text-emerald" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}
          {deal.adCode && (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-body text-xs text-stone">
                {deal.adCode}
              </span>
              <button
                type="button"
                onClick={(e) => copyValue(e, deal.adCode!, 'code')}
                className="shrink-0 text-stone hover:text-emerald"
                aria-label="Copy ad code"
              >
                {copiedField === 'code' ? (
                  <Check className="h-3.5 w-3.5 text-emerald" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
