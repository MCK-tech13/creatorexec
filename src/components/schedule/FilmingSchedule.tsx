import { useMemo, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useDraggable } from '@dnd-kit/core'
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  GripVertical,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react'
import type { DaySchedule, MergedProduct } from '../../types'
import {
  collapseDayVideos,
  dayFilmedTotal,
  type CollapsedScheduleRow,
} from '../../lib/schedule/collapseDayVideos'
import { dayVideoOverage } from '../../lib/schedule/moveCollapsedRow'
import { formatDeadlineCountdown } from '../../lib/schedule/deadlineUtils'
import { formatScheduleText } from '../../lib/schedule/scheduleBuilder'
import { getScheduleTierExplanation } from '../../lib/onboarding/beginnerCopy'
import { ProductChoosingTips } from '../sample/ProductChoosingTips'
import { TierBadge } from '../dashboard/TierBadge'
import { ContentPolicyDisclaimer } from '../ui/ContentPolicyDisclaimer'
import { ResetCurrentSprintModal } from '../sprint/ResetCurrentSprintModal'

interface FilmingScheduleProps {
  schedule: DaySchedule[]
  products: MergedProduct[]
  videosPerDay: number
  beginnerMode?: boolean
  momentumMode?: boolean
  getFilmedCount: (storageKey: string) => number
  onFilmedIncrement: (storageKey: string, max: number, productKey: string) => void
  onFilmedDecrement: (storageKey: string, productKey: string) => void
  onRemoveFromSchedule: (productKey: string) => void
  /** Move a collapsed product row (all of that product's videos that day) to another day. */
  onMoveProductDay: (productKey: string, fromDay: number, toDay: number) => void
  onBack: () => void
  onStartOver: () => void
  /** Soft clear of the live sprint (no review). Optional — schedule may omit it. */
  onResetCurrentSprint?: () => void
  retainerOnly?: boolean
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function dayDroppableId(day: number): string {
  return `day:${day}`
}

function rowDraggableId(day: number, productKey: string): string {
  return `row:${day}:${productKey}`
}

function parseDayDroppableId(id: string): number | null {
  const match = /^day:(\d+)$/.exec(id)
  return match ? Number(match[1]) : null
}

function parseRowDraggableId(id: string): { day: number; productKey: string } | null {
  const match = /^row:(\d+):(.+)$/.exec(id)
  if (!match) return null
  return { day: Number(match[1]), productKey: match[2] }
}

function ScheduleRowCard({
  row,
  beginnerMode,
  getFilmedCount,
  getProductFilmedCount,
  onFilmedIncrement,
  onFilmedDecrement,
  onRemoveFromSchedule,
  dragHandleProps,
  style,
  isDragging,
}: {
  row: CollapsedScheduleRow
  beginnerMode: boolean
  getFilmedCount: (storageKey: string) => number
  getProductFilmedCount: (productKey: string, fallback: number) => number
  onFilmedIncrement: (storageKey: string, max: number, productKey: string) => void
  onFilmedDecrement: (storageKey: string, productKey: string) => void
  onRemoveFromSchedule: (productKey: string) => void
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>
  style?: CSSProperties
  isDragging?: boolean
}) {
  const filmed = getFilmedCount(row.storageKey)
  const complete = filmed >= row.total
  const productFilmed = getProductFilmedCount(row.productKey, row.videosFilmed)
  const canRemove =
    !row.productKey.startsWith('deadline:') && !row.productKey.startsWith('retainer:')
  const scheduleExplanation = beginnerMode ? getScheduleTierExplanation(row.tier) : null

  return (
    <li
      className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4 sm:py-5 ${
        isDragging ? 'opacity-40' : ''
      }`}
      style={style}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="flex h-8 w-8 cursor-grab items-center justify-center border border-border-warm bg-white text-stone transition hover:border-ink hover:text-ink active:cursor-grabbing"
            aria-label={`Drag ${row.productName} to another day`}
            title="Drag to another day"
            {...dragHandleProps}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onFilmedDecrement(row.storageKey, row.productKey)}
            disabled={filmed === 0}
            className="flex h-8 w-8 items-center justify-center border border-border-warm bg-white font-body text-stone transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Decrement filmed count"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onFilmedIncrement(row.storageKey, row.total, row.productKey)}
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
            <p className="mt-1 font-body text-sm text-stone">{row.suggestedAngle}</p>
          )}
          {beginnerMode && !row.placementReason && scheduleExplanation ? (
            <p className="mt-1 font-body text-sm text-stone">{scheduleExplanation}</p>
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
        {complete && <Check className="h-4 w-4 text-emerald" aria-hidden />}
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
}

function DraggableScheduleRow({
  day,
  row,
  ...rest
}: {
  day: number
  row: CollapsedScheduleRow
  beginnerMode: boolean
  getFilmedCount: (storageKey: string) => number
  getProductFilmedCount: (productKey: string, fallback: number) => number
  onFilmedIncrement: (storageKey: string, max: number, productKey: string) => void
  onFilmedDecrement: (storageKey: string, productKey: string) => void
  onRemoveFromSchedule: (productKey: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: rowDraggableId(day, row.productKey),
    data: { day, productKey: row.productKey, productName: row.productName },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div ref={setNodeRef}>
      <ScheduleRowCard
        row={row}
        {...rest}
        dragHandleProps={{ ...listeners, ...attributes }}
        style={style}
        isDragging={isDragging}
      />
    </div>
  )
}

function DayDropZone({
  day,
  children,
  isOverTarget,
}: {
  day: number
  children: ReactNode
  isOverTarget: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDroppableId(day) })
  const highlight = isOver || isOverTarget

  return (
    <div
      ref={setNodeRef}
      className={`border-t border-border-warm px-4 py-4 sm:px-6 sm:py-6 md:px-8 ${
        highlight ? 'bg-terracotta-tint/40 ring-1 ring-inset ring-terracotta/30' : ''
      }`}
    >
      {children}
    </div>
  )
}

export function FilmingSchedule({
  schedule,
  products,
  videosPerDay,
  beginnerMode = false,
  momentumMode = false,
  getFilmedCount,
  onFilmedIncrement,
  onFilmedDecrement,
  onRemoveFromSchedule,
  onMoveProductDay,
  onBack,
  onStartOver,
  onResetCurrentSprint,
  retainerOnly = false,
}: FilmingScheduleProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(
    () => new Set(schedule.map((d) => d.day)),
  )
  const [showResetSprintConfirm, setShowResetSprintConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeDrag, setActiveDrag] = useState<{
    day: number
    productKey: string
    row: CollapsedScheduleRow
  } | null>(null)
  const [overDay, setOverDay] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  const filmedByProductId = useMemo(
    () => new Map(products.map((p) => [p.id, p.videosFilmed])),
    [products],
  )

  const overages = useMemo(
    () => dayVideoOverage(schedule, videosPerDay),
    [schedule, videosPerDay],
  )
  const overageByDay = useMemo(
    () => new Map(overages.map((entry) => [entry.day, entry])),
    [overages],
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

  const handleDragStart = (event: DragStartEvent) => {
    const parsed = parseRowDraggableId(String(event.active.id))
    if (!parsed) return
    const daySchedule = schedule.find((day) => day.day === parsed.day)
    if (!daySchedule) return
    const row = collapseDayVideos(parsed.day, daySchedule.videos).find(
      (entry) => entry.productKey === parsed.productKey,
    )
    if (!row) return
    setActiveDrag({ day: parsed.day, productKey: parsed.productKey, row })
  }

  const handleDragOver = (event: { over: { id: string | number } | null }) => {
    if (!event.over) {
      setOverDay(null)
      return
    }
    const overId = String(event.over.id)
    const asDay = parseDayDroppableId(overId)
    if (asDay != null) {
      setOverDay(asDay)
      return
    }
    const asRow = parseRowDraggableId(overId)
    setOverDay(asRow?.day ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const active = activeDrag
    setActiveDrag(null)
    setOverDay(null)
    if (!active || !event.over) return

    const overId = String(event.over.id)
    let toDay = parseDayDroppableId(overId)
    if (toDay == null) {
      toDay = parseRowDraggableId(overId)?.day ?? null
    }
    if (toDay == null || toDay === active.day) return

    setExpandedDays((prev) => {
      const next = new Set(prev)
      next.add(toDay!)
      return next
    })
    onMoveProductDay(active.productKey, active.day, toDay)
  }

  const handleDragCancel = () => {
    setActiveDrag(null)
    setOverDay(null)
  }

  return (
    <div>
      {retainerOnly && (
        <div className="mb-6 border border-emerald/30 bg-terracotta-tint px-4 py-4 sm:mb-8 sm:px-6 sm:py-5">
          <p className="font-body text-sm text-ink sm:text-base">
            Your sprint includes active retainer requirements. Add samples or upload a commission
            report anytime to fill the rest of your schedule.
          </p>
        </div>
      )}

      {momentumMode && (
        <div className="mb-6 border border-terracotta/40 bg-terracotta-tint px-4 py-4 sm:mb-8 sm:px-6 sm:py-5">
          <p className="font-body text-sm text-ink sm:text-base">
            Filming all your products consistently to find your winners.
          </p>
        </div>
      )}

      {overages.length > 0 && (
        <div
          className="mb-6 border border-terracotta/50 bg-terracotta-tint px-4 py-4 sm:mb-8 sm:px-6 sm:py-5"
          role="status"
        >
          <p className="font-body text-sm font-medium text-ink sm:text-base">
            Some days are over your daily target ({videosPerDay} videos/day). Moves are still
            allowed — this is your override.
          </p>
          <ul className="mt-2 space-y-1 font-body text-sm text-stone">
            {overages.map((entry) => (
              <li key={entry.day}>
                Day {entry.day} now has {entry.count} videos (target: {entry.target}).
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl md:text-4xl">
            Your Filming Schedule
          </h2>
          <p className="mt-2 font-body text-xs text-stone sm:mt-3 sm:text-sm">
            {momentumMode
              ? `${totalVideos} videos across ${schedule.length} days · balanced rotation`
              : `${totalVideos} videos across ${schedule.length} days · sorted by tier, then commission`}
          </p>
          <p className="mt-1 font-body text-xs text-stone">
            Drag any product to another day to rearrange. Protected tiers are editable too.
          </p>
          <ContentPolicyDisclaimer className="mt-3 max-w-2xl" />
        </div>
        <div className="flex flex-wrap gap-2">
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="space-y-3">
          {schedule.map((day) => {
            const isExpanded = expandedDays.has(day.day) || overDay === day.day || activeDrag != null
            // Keep drag targets reachable: while dragging, show every day body as a drop zone.
            const showBody = expandedDays.has(day.day) || activeDrag != null
            const dayLabel = DAY_NAMES[(day.day - 1) % 7]
            const filmedCount = dayFilmedTotal(day.day, day.videos, getFilmedCount)
            const totalSlots = day.videos.length
            const progress = totalSlots > 0 ? (filmedCount / totalSlots) * 100 : 0
            const collapsedRows = collapseDayVideos(day.day, day.videos)
            const overage = overageByDay.get(day.day)

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
                      {overage && (
                        <span className="font-body text-[11px] font-medium text-terracotta sm:text-xs">
                          {overage.count} videos (target: {overage.target})
                        </span>
                      )}
                    </div>
                    {totalSlots > 0 && (
                      <div className="mt-4 h-px w-full max-w-xs bg-track">
                        <div
                          className="h-px bg-terracotta transition-all duration-300"
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
                {showBody && (
                  <DayDropZone day={day.day} isOverTarget={overDay === day.day}>
                    {collapsedRows.length === 0 ? (
                      <p className="py-2 font-body text-sm text-stone">
                        No videos scheduled — drop a product here
                      </p>
                    ) : (
                      <ul className="divide-y divide-border-warm">
                        {collapsedRows.map((row) => (
                          <DraggableScheduleRow
                            key={row.storageKey}
                            day={day.day}
                            row={row}
                            beginnerMode={beginnerMode}
                            getFilmedCount={getFilmedCount}
                            getProductFilmedCount={getProductFilmedCount}
                            onFilmedIncrement={onFilmedIncrement}
                            onFilmedDecrement={onFilmedDecrement}
                            onRemoveFromSchedule={onRemoveFromSchedule}
                          />
                        ))}
                      </ul>
                    )}
                  </DayDropZone>
                )}
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {activeDrag ? (
            <div className="border border-border-warm bg-white px-4 shadow-lg">
              <ul>
                <ScheduleRowCard
                  row={activeDrag.row}
                  beginnerMode={beginnerMode}
                  getFilmedCount={getFilmedCount}
                  getProductFilmedCount={getProductFilmedCount}
                  onFilmedIncrement={() => {}}
                  onFilmedDecrement={() => {}}
                  onRemoveFromSchedule={() => {}}
                />
              </ul>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="mt-14 flex flex-col gap-3">
        <div className="flex gap-px">
          {!retainerOnly && (
            <button type="button" onClick={onBack} className="btn-outline flex-1 py-4">
              Back
            </button>
          )}
          <button type="button" onClick={onStartOver} className="btn-primary flex-1 py-4">
            {retainerOnly ? 'Add Products' : 'Analyze New Report'}
          </button>
        </div>
        {!retainerOnly && onResetCurrentSprint && (
          <button
            type="button"
            onClick={() => setShowResetSprintConfirm(true)}
            className="link-elegant self-center font-body text-sm text-stone"
          >
            Reset current sprint
          </button>
        )}
      </div>

      {showResetSprintConfirm && onResetCurrentSprint && (
        <ResetCurrentSprintModal
          onCancel={() => setShowResetSprintConfirm(false)}
          onConfirm={() => {
            setShowResetSprintConfirm(false)
            onResetCurrentSprint()
          }}
        />
      )}
    </div>
  )
}
