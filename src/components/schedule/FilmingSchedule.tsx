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
import { ContentPolicyDisclaimer } from '../ui/ContentPolicyDisclaimer'
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
        <div className="mb-6 border border-emerald/30 bg-blush-tint px-4 py-4 sm:mb-8 sm:px-6 sm:py-5">
          <p className="font-body text-sm text-ink sm:text-base">
            Your sprint includes active retainer requirements. Add samples or upload a commission
            report anytime to fill the rest of your schedule.
          </p>
        </div>
      )}

      {momentumMode && (
        <div className="mb-6 border border-blush/40 bg-blush-tint px-4 py-4 sm:mb-8 sm:px-6 sm:py-5">
          <p className="font-body text-sm text-ink sm:text-base">
            Momentum Mode — filming all your products consistently to find your winners.
          </p>
        </div>
      )}

      {sampleMode && onUploadReport && (
        <div className="mb-6 flex flex-col gap-4 border border-border-warm p-4 sm:mb-8 sm:p-6 md:flex-row md:items-center md:justify-between">
          <p className="font-body text-sm text-ink sm:text-base">
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

      <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl md:text-4xl">
            Your Filming Schedule
          </h2>
          <p className="mt-2 font-body text-xs text-stone sm:mt-3 sm:text-sm">
            {sampleMode
              ? `${totalVideos} videos across ${schedule.length} days · evenly distributed`
              : momentumMode
                ? `${totalVideos} videos across ${schedule.length} days · balanced rotation`
                : `${totalVideos} videos across ${schedule.length} days · sorted by tier, then commission`}
          </p>
          <ContentPolicyDisclaimer className="mt-3 max-w-2xl" />
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
                className="flex w-full items-center justify-between px-4 py-4 text-left transition hover:bg-white sm:px-6 sm:py-5 md:px-8 md:py-6"
              >
                <div className="min-w-0 flex-1 pr-3 sm:pr-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:gap-4">
                    <span className="font-display text-xl font-bold text-ink sm:text-2xl">
                      Day {day.day} — {dayLabel}
                    </span>
                    <span className="font-body text-[11px] uppercase tracking-[0.12em] text-stone sm:text-xs">
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
                <div className="border-t border-border-warm px-4 py-4 sm:px-6 sm:py-6 md:px-8">
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
                            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4 sm:py-5"
                          >
                            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
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
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <p
                                    className={`font-body text-sm font-medium sm:text-base ${complete ? 'text-emerald' : 'text-ink'}`}
                                  >
                                    {row.productName}
                                    <span className="ml-1.5 text-xs font-normal text-stone sm:ml-2">
                                      ({productFilmed} filmed total)
                                    </span>
                                  </p>
                                  {row.deadlineDate != null && (
                                    <span className="font-body text-xs font-medium text-stone">
                                      {formatDeadlineCountdown(row.deadlineDate)}
                                    </span>
                                  )}
                                </div>
                                {row.placementReason && (
                                  <p className="mt-1 font-body text-xs font-medium text-emerald sm:text-sm">
                                    {row.placementReason}
                                  </p>
                                )}
                                {!beginnerMode && row.suggestedAngle && (
                                  <p className="mt-1 font-body text-sm text-stone">
                                    {row.suggestedAngle}
                                  </p>
                                )}
                                {beginnerMode && !row.placementReason && scheduleExplanation ? (
                                  <p className="mt-1 font-body text-sm text-stone">
                                    {scheduleExplanation}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
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
