import { useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react'
import type { DaySchedule, MergedProduct } from '../../types'
import { useFilmingProgress } from '../../hooks/useFilmingProgress'
import { collapseDayVideos, dayFilmedTotal } from '../../lib/schedule/collapseDayVideos'
import { formatDeadlineCountdown } from '../../lib/schedule/deadlineUtils'
import { formatScheduleText } from '../../lib/schedule/scheduleBuilder'
import { SCHEDULE_TIER_STYLES } from '../../lib/theme/tierStyles'
import { AddDeadlineModal, type DeadlineFormData } from './AddDeadlineModal'

interface FilmingScheduleProps {
  schedule: DaySchedule[]
  products: MergedProduct[]
  onAddDeadline: (data: DeadlineFormData) => void
  onRemoveFromSchedule: (productKey: string) => void
  onBack: () => void
  onStartOver: () => void
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function FilmingSchedule({
  schedule,
  products,
  onAddDeadline,
  onRemoveFromSchedule,
  onBack,
  onStartOver,
}: FilmingScheduleProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(
    () => new Set(schedule.map((d) => d.day)),
  )
  const [copied, setCopied] = useState(false)
  const [showDeadlineModal, setShowDeadlineModal] = useState(false)
  const { getCount, increment, decrement } = useFilmingProgress()

  const filmedByProductId = useMemo(
    () => new Map(products.map((p) => [p.id, p.videosFilmed])),
    [products],
  )

  const toggleDay = (day: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  const copySchedule = async () => {
    await navigator.clipboard.writeText(formatScheduleText(schedule))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totalVideos = schedule.reduce((s, d) => s + d.videos.length, 0)

  const getProductFilmedCount = (productKey: string, fallback: number): number => {
    if (productKey.startsWith('deadline:')) return fallback
    return filmedByProductId.get(productKey) ?? fallback
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-3xl font-semibold text-ink">Your Filming Schedule</h2>
          <p className="mt-1 font-sans text-sm text-stone">
            {totalVideos} videos across {schedule.length} days · sorted by tier, then commission
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowDeadlineModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-tier-deadline/30 bg-tier-deadline/10 px-4 py-2.5 font-sans text-sm font-medium text-tier-deadline transition hover:border-tier-deadline/50 hover:bg-tier-deadline/15"
          >
            <Plus className="h-4 w-4" />
            Add Sample / Deadline
          </button>
          <button
            type="button"
            onClick={copySchedule}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald" />
                Copied!
              </>
            ) : (
              <>
                <ClipboardCopy className="h-4 w-4" />
                Copy Schedule
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {schedule.map((day) => {
          const isExpanded = expandedDays.has(day.day)
          const dayLabel = DAY_NAMES[(day.day - 1) % 7]
          const filmedCount = dayFilmedTotal(day.day, day.videos, getCount)
          const totalSlots = day.videos.length
          const progress = totalSlots > 0 ? (filmedCount / totalSlots) * 100 : 0
          const collapsedRows = collapseDayVideos(day.day, day.videos)

          return (
            <div key={day.day} className="card-panel overflow-hidden">
              <button
                type="button"
                onClick={() => toggleDay(day.day)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-cream/60"
              >
                <div className="flex-1 pr-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-heading text-lg font-semibold text-ink">
                      Day {day.day} — {dayLabel}
                    </span>
                    <span className="font-sans text-sm text-stone">
                      {filmedCount}/{totalSlots} filmed
                    </span>
                  </div>
                  {totalSlots > 0 && (
                    <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-track">
                      <div
                        className="h-full rounded-full bg-emerald transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-stone" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-stone" />
                )}
              </button>
              {isExpanded && (
                <div className="border-t border-border-warm px-5 py-3">
                  {collapsedRows.length === 0 ? (
                    <p className="py-2 font-sans text-sm text-stone">No videos scheduled</p>
                  ) : (
                    <ul className="space-y-2">
                      {collapsedRows.map((row) => {
                        const style = SCHEDULE_TIER_STYLES[row.tier]
                        const filmed = getCount(row.storageKey)
                        const complete = filmed >= row.total
                        const productFilmed = getProductFilmedCount(
                          row.productKey,
                          row.videosFilmed,
                        )
                        const canRemove = !row.productKey.startsWith('deadline:')

                        return (
                          <li
                            key={row.storageKey}
                            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${
                              complete
                                ? 'border border-emerald/25 bg-emerald/5'
                                : 'bg-cream/80'
                            }`}
                          >
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => decrement(row.storageKey)}
                                disabled={filmed === 0}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-warm bg-cream-card font-sans text-stone transition hover:border-emerald/40 hover:text-emerald disabled:cursor-not-allowed disabled:opacity-30"
                                aria-label="Decrement filmed count"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => increment(row.storageKey, row.total)}
                                disabled={complete}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-warm bg-cream-card font-sans text-stone transition hover:border-emerald/40 hover:text-emerald disabled:cursor-not-allowed disabled:opacity-30"
                                aria-label="Increment filmed count"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 font-sans text-xs font-medium ${style.bg} ${style.text} ${style.border}`}
                            >
                              {row.tier === 'Deadline' ? 'Deadline' : row.tier}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p
                                  className={`font-sans font-medium ${complete ? 'text-emerald' : 'text-ink'}`}
                                >
                                  {row.productName}
                                  <span className="ml-2 text-xs font-normal text-stone">
                                    ({productFilmed} filmed total)
                                  </span>
                                </p>
                                {row.deadlineDate != null && (
                                  <span className="font-sans text-xs font-medium text-tier-deadline">
                                    {formatDeadlineCountdown(row.deadlineDate)}
                                  </span>
                                )}
                              </div>
                              <p
                                className={`font-sans text-sm ${complete ? 'text-emerald-hover' : 'text-stone'}`}
                              >
                                {row.suggestedAngle}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                className={`font-sans text-sm font-medium tabular-nums ${
                                  complete ? 'text-emerald' : 'text-stone'
                                }`}
                              >
                                {filmed} / {row.total} filmed
                              </span>
                              {complete && (
                                <Check className="h-5 w-5 text-emerald" aria-hidden />
                              )}
                              {canRemove && (
                                <button
                                  type="button"
                                  onClick={() => onRemoveFromSchedule(row.productKey)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-warm bg-cream-card text-stone transition hover:border-tier-cut/50 hover:text-tier-cut"
                                  aria-label="Remove from schedule"
                                  title="Remove from schedule"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-8 flex gap-3">
        <button type="button" onClick={onBack} className="btn-secondary flex-1 py-3 text-sm">
          Back
        </button>
        <button type="button" onClick={onStartOver} className="btn-primary flex-1 py-3 text-sm">
          Analyze New Report
        </button>
      </div>

      {showDeadlineModal && (
        <AddDeadlineModal
          onClose={() => setShowDeadlineModal(false)}
          onSubmit={onAddDeadline}
        />
      )}
    </div>
  )
}
