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
import { getScheduleTierExplanation } from '../../lib/onboarding/beginnerCopy'
import { ProductChoosingTips } from '../sample/ProductChoosingTips'
import { TierBadge } from '../dashboard/TierBadge'
import { AddDeadlineModal, type DeadlineFormData } from './AddDeadlineModal'

interface FilmingScheduleProps {
  schedule: DaySchedule[]
  products: MergedProduct[]
  beginnerMode?: boolean
  sampleMode?: boolean
  momentumMode?: boolean
  onAddDeadline: (data: DeadlineFormData) => void
  onRemoveFromSchedule: (productKey: string) => void
  onBack: () => void
  onStartOver: () => void
  onUploadReport?: () => void
  retainerOnly?: boolean
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function FilmingSchedule({
  schedule,
  products,
  beginnerMode = false,
  sampleMode = false,
  momentumMode = false,
  onAddDeadline,
  onRemoveFromSchedule,
  onBack,
  onStartOver,
  onUploadReport,
  retainerOnly = false,
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
      {retainerOnly && (
        <div className="mb-8 border border-emerald/30 bg-blush-tint px-6 py-5">
          <p className="font-body text-base text-ink">
            Your sprint includes active retainer requirements. Add samples or upload a commission
            report anytime to fill the rest of your schedule.
          </p>
        </div>
      )}

      {momentumMode && (
        <div className="mb-8 border border-blush/40 bg-blush-tint px-6 py-5">
          <p className="font-body text-base text-ink">
            Momentum Mode — filming all your products consistently to find your winners.
          </p>
        </div>
      )}

      {sampleMode && onUploadReport && (
        <div className="mb-8 flex flex-col gap-4 border border-border-warm p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-base text-ink">
            You&apos;re in Sample Mode. Once you have sales data, upload your commission report
            to unlock full product rankings.
          </p>
          <button
            type="button"
            onClick={onUploadReport}
            className="btn-primary shrink-0 px-6 py-3 text-sm"
          >
            Upload Report
          </button>
        </div>
      )}

      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold text-ink md:text-4xl">Your Filming Schedule</h2>
          <p className="mt-3 font-body text-sm text-stone">
            {sampleMode
              ? `${totalVideos} videos across ${schedule.length} days · evenly distributed`
              : momentumMode
                ? `${totalVideos} videos across ${schedule.length} days · balanced rotation`
                : `${totalVideos} videos across ${schedule.length} days · sorted by tier, then commission`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!sampleMode && (
          <button
            type="button"
            onClick={() => setShowDeadlineModal(true)}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Sample / Deadline
          </button>
          )}
          <button
            type="button"
            onClick={copySchedule}
            className="btn-outline inline-flex items-center gap-2 px-4 py-2.5 text-sm"
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

      <div className="mb-10">
        <ProductChoosingTips />
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
            <div key={day.day} className="border border-border-warm">
              <button
                type="button"
                onClick={() => toggleDay(day.day)}
                className="flex w-full items-center justify-between px-8 py-6 text-left transition hover:bg-white"
              >
                <div className="flex-1 pr-4">
                  <div className="flex flex-wrap items-baseline gap-4">
                    <span className="font-display text-2xl font-bold text-ink">
                      Day {day.day} — {dayLabel}
                    </span>
                    <span className="font-body text-xs uppercase tracking-[0.12em] text-stone">
                      {filmedCount}/{totalSlots} filmed
                    </span>
                  </div>
                  {totalSlots > 0 && (
                    <div className="mt-4 h-px w-full max-w-xs bg-track">
                      <div
                        className="h-px bg-blush transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-stone" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-stone" />
                )}
              </button>
              {isExpanded && (
                <div className="border-t border-border-warm px-8 py-6">
                  {collapsedRows.length === 0 ? (
                    <p className="py-2 font-body text-sm text-stone">No videos scheduled</p>
                  ) : (
                    <ul className="divide-y divide-border-warm">
                      {collapsedRows.map((row) => {
                        const filmed = getCount(row.storageKey)
                        const complete = filmed >= row.total
                        const productFilmed = getProductFilmedCount(
                          row.productKey,
                          row.videosFilmed,
                        )
                        const canRemove =
                          !row.productKey.startsWith('deadline:') &&
                          !row.productKey.startsWith('retainer:')
                        const scheduleExplanation = beginnerMode
                          ? getScheduleTierExplanation(row.tier)
                          : null

                        return (
                          <li
                            key={row.storageKey}
                            className="flex items-center gap-4 py-5"
                          >
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => decrement(row.storageKey)}
                                disabled={filmed === 0}
                                className="flex h-8 w-8 items-center justify-center border border-border-warm bg-white font-body text-stone transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                                aria-label="Decrement filmed count"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => increment(row.storageKey, row.total)}
                                disabled={complete}
                                className="flex h-8 w-8 items-center justify-center border border-border-warm bg-white font-body text-stone transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                                aria-label="Increment filmed count"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <TierBadge tier={row.tier} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p
                                  className={`font-body font-medium ${complete ? 'text-emerald' : 'text-ink'}`}
                                >
                                  {row.productName}
                                  <span className="ml-2 text-xs font-normal text-stone">
                                    ({productFilmed} filmed total)
                                  </span>
                                </p>
                                {row.deadlineDate != null && (
                                  <span className="font-body text-xs font-medium text-stone">
                                    {formatDeadlineCountdown(row.deadlineDate)}
                                  </span>
                                )}
                              </div>
                              {beginnerMode && scheduleExplanation ? (
                                <p className="font-body text-sm text-stone">
                                  {scheduleExplanation}
                                </p>
                              ) : !beginnerMode ? (
                                <p className="font-body text-sm text-stone">
                                  {row.suggestedAngle}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                className={`font-body text-sm font-medium tabular-nums ${
                                  complete ? 'text-emerald' : 'text-stone'
                                }`}
                              >
                                {filmed} / {row.total} filmed
                              </span>
                              {complete && (
                                <Check className="h-4 w-4 text-emerald" aria-hidden />
                              )}
                              {canRemove && (
                                <button
                                  type="button"
                                  onClick={() => onRemoveFromSchedule(row.productKey)}
                                  className="flex h-8 w-8 items-center justify-center border border-border-warm bg-white text-stone transition hover:border-ink hover:text-ink"
                                  aria-label="Remove from schedule"
                                  title="Remove from schedule"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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

      <div className="mt-14 flex gap-px">
        {!retainerOnly && (
          <button type="button" onClick={onBack} className="btn-outline flex-1 py-4">
            Back
          </button>
        )}
        <button type="button" onClick={onStartOver} className="btn-primary flex-1 py-4">
          {retainerOnly
            ? 'Add Products'
            : sampleMode
              ? 'Start Over'
              : 'Analyze New Report'}
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
