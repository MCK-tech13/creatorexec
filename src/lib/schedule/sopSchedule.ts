/**
 * SOP mode sprint scheduler (PR 4a).
 *
 * Separate from Full (`scheduleBuilder`) and Momentum (`momentumModeSchedule`).
 * Uses sopTier / sopBand from assignment — does not re-tier.
 *
 * In scope: Urgent day-1 priority, ideal slot demand from SOP budgets,
 * sacrifice ladder when oversubscribed.
 * Out of scope (PR 4b+): category Sitting batching, format ratio, sanity flags.
 */
import type {
  DaySchedule,
  DeadlineProduct,
  MergedProduct,
  ScheduledVideo,
  ScheduleTierLabel,
  SprintConfig,
} from '../../types'
import {
  computeSopScaling,
  SOP_MID_VIDEOS_PER_PRODUCT,
  SOP_ROTATOR_VIDEOS_PER_PRODUCT,
} from '../analysis/sopTierEngine'
import { isSopUrgentSample, SOP_URGENT_DEADLINE_DAYS } from '../analysis/sopTierAssign'
import { formatScheduleProductName } from './scheduleDisplay'
import { deadlineReason, retainerReason } from './placementReasons'
import { AngleRotationSession } from './angleRotation'
import { totalDeadlineSlotsNeeded } from './slotAllocation'

/** Minimum Day-1 slots for each urgent sample (0 videos + deadline ≤4 days). */
export const SOP_URGENT_DAY1_MIN_SLOTS = 2

/** Band A / Band B graduation filming per product per sprint. */
export const SOP_BAND_VIDEOS_PER_PRODUCT = 2

/** New Sample products get at most this many fill slots each (from remainder pool). */
export const SOP_NEW_SAMPLE_SLOTS_PER_PRODUCT = 1

/**
 * Max videos for one New Sample product on a single day (same fulfillment-day
 * pattern as Urgent samples: 2 on a day, then stop — do not fake-pad past this).
 */
export const SOP_NEW_SAMPLE_MAX_PER_DAY = 2

export type SopSlotKind =
  | 'urgent'
  | 'anchor'
  | 'rotator'
  | 'mid'
  | 'bandA'
  | 'bandB'
  | 'newSample'
  | 'deadline'
  | 'retainer'

export interface SopSlotDemand {
  product: MergedProduct
  kind: SopSlotKind
  /** Ideal slots before sacrifice. */
  slots: number
  /** Commission per item — used when sacrificing Band B (lowest first). */
  commissionPerItem: number
}

export interface SopSacrificeReport {
  newSampleSlotsCut: number
  bandBSlotsCut: number
  midSlotsCut: number
  /** Products that lost Band B slots, lowest CPI first. */
  bandBCuts: Array<{ productName: string; commissionPerItem: number; slotsCut: number }>
}

function commissionPerItem(product: MergedProduct): number {
  if (product.itemsSold <= 0) return 0
  return product.commission / product.itemsSold
}

function makeVideo(
  product: MergedProduct,
  tier: ScheduleTierLabel,
  placementReason: string,
  angleSession: AngleRotationSession,
  extras?: Partial<ScheduledVideo>,
): ScheduledVideo {
  return {
    slotId: '',
    productKey: product.id,
    productId: product.productId,
    productName: formatScheduleProductName(product.productName),
    tier,
    suggestedAngle: angleSession.consumeAngle(product),
    commission: product.commission,
    videosFilmed: product.videosFilmed,
    deadlineDate: product.firstVideoDeadline ?? undefined,
    placementReason,
    ...extras,
  }
}

function buildDeadlineVideos(deadlineProducts: DeadlineProduct[]): ScheduledVideo[] {
  const sorted = [...deadlineProducts].sort(
    (a, b) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime(),
  )
  const videos: ScheduledVideo[] = []
  for (const item of sorted) {
    const label = item.brand ? `${item.productName} (${item.brand})` : item.productName
    for (let i = 0; i < item.videosRequired; i++) {
      videos.push({
        slotId: '',
        productKey: `deadline:${item.id}`,
        productId: `deadline:${item.id}`,
        productName: formatScheduleProductName(label),
        tier: 'Deadline',
        suggestedAngle: 'Sample / deadline content — film ASAP',
        commission: 0,
        videosFilmed: item.videosFilmed,
        deadlineDate: item.deadlineDate,
        brand: item.brand,
        placementReason: deadlineReason(item.deadlineDate),
      })
    }
  }
  return videos
}

function placeFixedVideos(
  perDay: ScheduledVideo[][],
  videos: ScheduledVideo[],
  cap: number,
): void {
  let cursor = 0
  for (const video of videos) {
    let placed = false
    for (let attempt = 0; attempt < perDay.length; attempt++) {
      const day = (cursor + attempt) % perDay.length
      if (perDay[day].length < cap) {
        perDay[day].push(video)
        cursor = (day + 1) % perDay.length
        placed = true
        break
      }
    }
    if (!placed) break
  }
}

function reasonForKind(kind: SopSlotKind): string {
  switch (kind) {
    case 'urgent':
      return `Urgent sample — Day 1 priority (deadline ≤${SOP_URGENT_DEADLINE_DAYS} days)`
    case 'anchor':
      return 'SOP Anchor — daily rotation'
    case 'rotator':
      return 'SOP Rotator'
    case 'mid':
      return 'SOP Mid'
    case 'bandA':
      return 'SOP Band A winner'
    case 'bandB':
      return 'SOP Band B winner'
    case 'newSample':
      return 'SOP New Sample fill'
    default:
      return 'SOP schedule'
  }
}

function displayTierFor(product: MergedProduct): ScheduleTierLabel {
  return product.tier
}

/**
 * Build ideal slot demand from SOP-ranked products (before sacrifice).
 * Excludes Retired / Cut and products not in rotation.
 */
export function buildSopSlotDemand(
  products: MergedProduct[],
  dailyVolume: number,
  sprintDays: SprintConfig['sprintDays'],
  asOfDate: Date = new Date(),
): SopSlotDemand[] {
  const scaling = computeSopScaling({ dailyVolume, sprintDays })
  const active = products.filter(
    (p) =>
      p.inRotation &&
      p.tier !== 'Cut' &&
      p.sopTier !== 'Retired' &&
      p.sopTier != null,
  )

  const demand: SopSlotDemand[] = []

  for (const product of active) {
    const cpi = commissionPerItem(product)
    const sop = product.sopTier!

    if (sop === 'Urgent' || isSopUrgentSample(product, asOfDate)) {
      demand.push({
        product,
        kind: 'urgent',
        slots: SOP_URGENT_DAY1_MIN_SLOTS,
        commissionPerItem: cpi,
      })
      continue
    }

    switch (sop) {
      case 'Anchor':
        demand.push({
          product,
          kind: 'anchor',
          slots: scaling.products.anchorVideosPerProduct,
          commissionPerItem: cpi,
        })
        break
      case 'Rotator':
        demand.push({
          product,
          kind: 'rotator',
          slots: SOP_ROTATOR_VIDEOS_PER_PRODUCT,
          commissionPerItem: cpi,
        })
        break
      case 'Mid':
        demand.push({
          product,
          kind: 'mid',
          slots: SOP_MID_VIDEOS_PER_PRODUCT,
          commissionPerItem: cpi,
        })
        break
      case 'BandA':
        demand.push({
          product,
          kind: 'bandA',
          slots: SOP_BAND_VIDEOS_PER_PRODUCT,
          commissionPerItem: cpi,
        })
        break
      case 'BandB':
        demand.push({
          product,
          kind: 'bandB',
          slots: SOP_BAND_VIDEOS_PER_PRODUCT,
          commissionPerItem: cpi,
        })
        break
      case 'NewSample': {
        // Filled later from remainder pool — mark as 0 here; allocator adds fill.
        demand.push({
          product,
          kind: 'newSample',
          slots: 0,
          commissionPerItem: cpi,
        })
        break
      }
      default:
        break
    }
  }

  // Distribute New Sample fill pool (scaling remainder) 1 slot each by commission desc.
  let fillPool = scaling.slots.newSampleFillSlots
  const newSamples = demand
    .filter((d) => d.kind === 'newSample')
    .sort((a, b) => b.product.commission - a.product.commission)
  for (const row of newSamples) {
    if (fillPool <= 0) break
    const take = Math.min(SOP_NEW_SAMPLE_SLOTS_PER_PRODUCT, fillPool)
    row.slots = take
    fillPool -= take
  }

  return demand.filter((d) => d.slots > 0)
}

/**
 * Sacrifice ladder when demand exceeds budget.
 * Order: New Sample fill → Band B (lowest CPI first) → Mid (counted for day-level later).
 * Never cuts: Urgent, Anchor, Rotator, Band A.
 */
export function applySopSacrificeLadder(
  demand: SopSlotDemand[],
  budget: number,
): { demand: SopSlotDemand[]; report: SopSacrificeReport } {
  const next = demand.map((d) => ({ ...d }))
  const report: SopSacrificeReport = {
    newSampleSlotsCut: 0,
    bandBSlotsCut: 0,
    midSlotsCut: 0,
    bandBCuts: [],
  }

  const total = () => next.reduce((sum, d) => sum + d.slots, 0)

  // 1) Cut New Sample fill first (lowest commission first among fill).
  while (total() > budget) {
    const fill = next
      .filter((d) => d.kind === 'newSample' && d.slots > 0)
      .sort((a, b) => a.product.commission - b.product.commission)
    if (fill.length === 0) break
    fill[0].slots -= 1
    report.newSampleSlotsCut += 1
  }

  // 2) Cut Band B winner slots — lowest commission-per-item first.
  while (total() > budget) {
    const bandB = next
      .filter((d) => d.kind === 'bandB' && d.slots > 0)
      .sort((a, b) => {
        if (a.commissionPerItem !== b.commissionPerItem) {
          return a.commissionPerItem - b.commissionPerItem
        }
        return a.product.commission - b.product.commission
      })
    if (bandB.length === 0) break
    const victim = bandB[0]
    victim.slots -= 1
    report.bandBSlotsCut += 1
    const existing = report.bandBCuts.find((c) => c.productName === victim.product.productName)
    if (existing) existing.slotsCut += 1
    else {
      report.bandBCuts.push({
        productName: victim.product.productName,
        commissionPerItem: victim.commissionPerItem,
        slotsCut: 1,
      })
    }
  }

  // 3) Mid cuts are applied during day packing (one Mid slot from overloaded day).
  // Pre-emptively trim Mid only if still over budget after Band B (global last resort).
  while (total() > budget) {
    const mids = next
      .filter((d) => d.kind === 'mid' && d.slots > 0)
      .sort((a, b) => a.product.commission - b.product.commission)
    if (mids.length === 0) break
    mids[0].slots -= 1
    report.midSlotsCut += 1
  }

  return {
    demand: next.filter((d) => d.slots > 0),
    report,
  }
}

/** Prefer Day 1 + Day 3 on a 3-day sprint; otherwise first↔last evenly spaced. */
export function preferredMidDayIndices(sprintDays: number, slotCount: number): number[] {
  const slots = Math.max(1, slotCount)
  if (slots === 1) return [0]
  if (sprintDays === 3 && slots === 2) return [0, 2]
  const days: number[] = []
  for (let i = 0; i < slots; i++) {
    days.push(Math.round((i * (sprintDays - 1)) / (slots - 1)))
  }
  return [...new Set(days)]
}

function remainingCapacity(perDay: ScheduledVideo[][], day: number, cap: number): number {
  return Math.max(0, cap - perDay[day].length)
}

function tryPlace(
  perDay: ScheduledVideo[][],
  day: number,
  video: ScheduledVideo,
  cap: number,
): boolean {
  if (remainingCapacity(perDay, day, cap) <= 0) return false
  perDay[day].push(video)
  return true
}

/** Prefer spread days; fall back to any open day (may stack on one day). */
function placeSpreadSlots(
  perDay: ScheduledVideo[][],
  videoFactory: () => ScheduledVideo,
  slots: number,
  cap: number,
  preferDays?: number[],
): number {
  const sprintDays = perDay.length
  let placed = 0
  const order =
    preferDays && preferDays.length > 0
      ? preferDays
      : Array.from({ length: sprintDays }, (_, i) =>
          Math.floor((i * sprintDays) / Math.max(slots, 1)) % sprintDays,
        )

  const preferred = [...new Set(order)].filter((d) => d >= 0 && d < sprintDays)
  for (const day of preferred) {
    if (placed >= slots) break
    if (tryPlace(perDay, day, videoFactory(), cap)) placed += 1
  }

  for (let day = 0; day < sprintDays && placed < slots; day++) {
    while (placed < slots && tryPlace(perDay, day, videoFactory(), cap)) {
      placed += 1
    }
  }

  return placed
}

/**
 * Place at most one slot per day for a product (Mid / Rotator spread rule).
 * Prefers `preferDays`; only stacks on the same day if every other day is full.
 */
export function placeDistinctDaySlots(
  perDay: ScheduledVideo[][],
  videoFactory: () => ScheduledVideo,
  slots: number,
  cap: number,
  preferDays: number[],
): number {
  const sprintDays = perDay.length
  let placed = 0
  const usedDays = new Set<number>()

  const tryDay = (day: number): boolean => {
    if (usedDays.has(day)) return false
    if (!tryPlace(perDay, day, videoFactory(), cap)) return false
    usedDays.add(day)
    placed += 1
    return true
  }

  for (const day of preferDays) {
    if (placed >= slots) break
    if (day < 0 || day >= sprintDays) continue
    tryDay(day)
  }

  for (let day = 0; day < sprintDays && placed < slots; day++) {
    tryDay(day)
  }

  // Last resort: same-day stack only when no unused day has capacity.
  while (placed < slots) {
    let progressed = false
    for (let day = 0; day < sprintDays; day++) {
      if (placed >= slots) break
      if (tryPlace(perDay, day, videoFactory(), cap)) {
        placed += 1
        progressed = true
      }
    }
    if (!progressed) break
  }

  return placed
}

function countProductOnDay(dayVideos: ScheduledVideo[], productId: string): number {
  return dayVideos.filter((v) => v.productKey === productId).length
}

/**
 * After tiered demand is placed, pad under-full days by cycling New Sample products.
 * Caps any single New Sample at {@link SOP_NEW_SAMPLE_MAX_PER_DAY} videos per day.
 * If every available New Sample is already at that cap for the day, leaves remaining
 * capacity empty rather than force-repeating past the cap.
 */
export function padDaysWithNewSampleFill(
  perDay: ScheduledVideo[][],
  newSampleProducts: MergedProduct[],
  cap: number,
  angleSession: AngleRotationSession,
): number {
  if (newSampleProducts.length === 0) return 0
  const pool = [...newSampleProducts].sort((a, b) => b.commission - a.commission)
  let cursor = 0
  let added = 0

  for (let day = 0; day < perDay.length; day++) {
    while (remainingCapacity(perDay, day, cap) > 0) {
      let placed = false
      for (let attempt = 0; attempt < pool.length; attempt++) {
        const product = pool[(cursor + attempt) % pool.length]
        if (countProductOnDay(perDay[day], product.id) >= SOP_NEW_SAMPLE_MAX_PER_DAY) {
          continue
        }
        const video = makeVideo(
          product,
          displayTierFor(product),
          reasonForKind('newSample'),
          angleSession,
        )
        if (!tryPlace(perDay, day, video, cap)) break
        cursor = (cursor + attempt + 1) % pool.length
        added += 1
        placed = true
        break
      }
      // All New Samples already at per-day cap — leave remaining slots empty.
      if (!placed) break
    }
  }

  return added
}

/**
 * Last-resort day overload: remove one Mid (Rising) slot from the overloaded day.
 * Never removes Urgent / Anchor / Rotator / Band A.
 */
export function sacrificeOneMidSlotOnDay(
  dayVideos: ScheduledVideo[],
  midProductIds: Set<string>,
): ScheduledVideo[] {
  const idx = dayVideos.findIndex(
    (v) => midProductIds.has(v.productKey) && v.tier === 'Rising',
  )
  if (idx === -1) return dayVideos
  return [...dayVideos.slice(0, idx), ...dayVideos.slice(idx + 1)]
}

export interface BuildSopModeScheduleResult {
  schedule: DaySchedule[]
  demand: SopSlotDemand[]
  sacrifice: SopSacrificeReport
  budget: number
}

/**
 * Build the SOP-mode filming schedule.
 * Retainer + external deadline products still reserve capacity first (same as other modes).
 */
export function buildSopModeSchedule(
  products: MergedProduct[],
  config: SprintConfig,
  deadlineProducts: DeadlineProduct[] = [],
  excludedIds: Set<string> = new Set(),
  retainerVideos: ScheduledVideo[] = [],
  asOfDate: Date = new Date(),
): DaySchedule[] {
  return buildSopModeScheduleDetailed(
    products,
    config,
    deadlineProducts,
    excludedIds,
    retainerVideos,
    asOfDate,
  ).schedule
}

export function buildSopModeScheduleDetailed(
  products: MergedProduct[],
  config: SprintConfig,
  deadlineProducts: DeadlineProduct[] = [],
  excludedIds: Set<string> = new Set(),
  retainerVideos: ScheduledVideo[] = [],
  asOfDate: Date = new Date(),
): BuildSopModeScheduleResult {
  const { sprintDays, videosPerDay } = config
  const cap = Math.max(1, videosPerDay)
  const totalSlots = cap * sprintDays
  const reserved =
    totalDeadlineSlotsNeeded(deadlineProducts) + retainerVideos.length
  const budget = Math.max(0, totalSlots - reserved)

  const eligible = products.filter((p) => p.inRotation && !excludedIds.has(p.id))
  const rawDemand = buildSopSlotDemand(eligible, videosPerDay, sprintDays, asOfDate)
  const { demand, report: sacrifice } = applySopSacrificeLadder(rawDemand, budget)

  const angleSession = new AngleRotationSession()
  const perDay: ScheduledVideo[][] = Array.from({ length: sprintDays }, () => [])

  // Retainers + pipeline deadlines first (never displaced by SOP product fill).
  const taggedRetainers = retainerVideos.map((video) => ({
    ...video,
    placementReason: video.placementReason ?? retainerReason(video.brand ?? 'Retainer'),
  }))
  placeFixedVideos(perDay, taggedRetainers, cap)
  placeFixedVideos(perDay, buildDeadlineVideos(deadlineProducts), cap)

  const midIds = new Set(
    demand.filter((d) => d.kind === 'mid').map((d) => d.product.id),
  )

  // --- 1) Urgent: minimum 2 slots on Day 1 before anything else ---
  const urgents = demand.filter((d) => d.kind === 'urgent')
  for (const row of urgents) {
    for (let i = 0; i < row.slots; i++) {
      const video = makeVideo(
        row.product,
        displayTierFor(row.product),
        reasonForKind('urgent'),
        angleSession,
        {
          deadlineDate: row.product.firstVideoDeadline ?? undefined,
        },
      )
      if (!tryPlace(perDay, 0, video, cap)) {
        // Day 1 full — spill to earliest open day (still after urgents tried day 1).
        placeSpreadSlots(perDay, () => video, 1, cap)
      }
    }
  }

  // --- 2) Anchors: one slot per day when possible ---
  for (const row of demand.filter((d) => d.kind === 'anchor')) {
    const days = Array.from({ length: sprintDays }, (_, i) => i)
    placeSpreadSlots(
      perDay,
      () =>
        makeVideo(row.product, displayTierFor(row.product), reasonForKind('anchor'), angleSession),
      row.slots,
      cap,
      days,
    )
  }

  // --- 3) Protected flexible: Rotator (spread across distinct days), Band A ---
  for (const row of demand.filter((d) => d.kind === 'rotator')) {
    placeDistinctDaySlots(
      perDay,
      () =>
        makeVideo(
          row.product,
          displayTierFor(row.product),
          reasonForKind('rotator'),
          angleSession,
        ),
      row.slots,
      cap,
      preferredMidDayIndices(sprintDays, row.slots),
    )
  }
  for (const row of demand.filter((d) => d.kind === 'bandA')) {
    placeDistinctDaySlots(
      perDay,
      () =>
        makeVideo(row.product, displayTierFor(row.product), reasonForKind('bandA'), angleSession),
      row.slots,
      cap,
      preferredMidDayIndices(sprintDays, row.slots),
    )
  }

  // --- 4) Mid — must split across different days (prefer Day 1 + Day 3 on 3-day) ---
  for (const row of demand.filter((d) => d.kind === 'mid')) {
    placeDistinctDaySlots(
      perDay,
      () =>
        makeVideo(row.product, displayTierFor(row.product), reasonForKind('mid'), angleSession),
      row.slots,
      cap,
      preferredMidDayIndices(sprintDays, row.slots),
    )
  }

  // --- 5) Band B (already globally sacrificed by CPI) ---
  for (const row of demand.filter((d) => d.kind === 'bandB')) {
    placeDistinctDaySlots(
      perDay,
      () =>
        makeVideo(row.product, displayTierFor(row.product), reasonForKind('bandB'), angleSession),
      row.slots,
      cap,
      preferredMidDayIndices(sprintDays, row.slots),
    )
  }

  // --- 6) Initial New Sample fill from demand (1 each), then pad days to capacity ---
  for (const row of demand.filter((d) => d.kind === 'newSample')) {
    placeSpreadSlots(
      perDay,
      () =>
        makeVideo(
          row.product,
          displayTierFor(row.product),
          reasonForKind('newSample'),
          angleSession,
        ),
      row.slots,
      cap,
    )
  }

  const newSampleProducts = eligible.filter((p) => p.sopTier === 'NewSample')
  padDaysWithNewSampleFill(perDay, newSampleProducts, cap, angleSession)

  // Day-level last resort: if any day exceeds cap (should not after tryPlace),
  // or if we somehow over-placed — trim Mid from overloaded days.
  for (let day = 0; day < perDay.length; day++) {
    while (perDay[day].length > cap) {
      const trimmed = sacrificeOneMidSlotOnDay(perDay[day], midIds)
      if (trimmed.length === perDay[day].length) break
      perDay[day] = trimmed
      sacrifice.midSlotsCut += 1
    }
  }

  angleSession.persist()

  const schedule: DaySchedule[] = Array.from({ length: sprintDays }, (_, i) => ({
    day: i + 1,
    videos: perDay[i].map((video, slot) => ({
      ...video,
      slotId: `d${i + 1}-s${slot}-${video.productName}-${video.tier}`,
    })),
  }))

  return { schedule, demand, sacrifice, budget }
}
