/**
 * SOP-based tier scaling math (Creator SOP mode).
 *
 * Pure functions only — no UI, no schedule builder.
 * Does NOT replace tierEngine.ts (Anchor/Rising/Test/Cut); that remains default.
 *
 * Baseline sanity (30 videos/day × 3-day sprint):
 * - 90 slots → Anchor 12 / Rotator 12 / Mid 30 / T6 fill 36
 * - Products → 4 Anchors / 6 Rotators / 15 Mid
 * - Band A / Band B sprint thresholds → $15 / $5
 */
import type { SprintDays } from '../../types'

/** Exact share of sprint slots for Anchor and Rotator (13.333…% = 2/15). */
export const SOP_TOP_TIER_SLOT_SHARE_NUM = 2
export const SOP_TOP_TIER_SLOT_SHARE_DEN = 15

/** Exact share of sprint slots for Mid (33.333…% = 1/3). */
export const SOP_MID_SLOT_SHARE_NUM = 1
export const SOP_MID_SLOT_SHARE_DEN = 3

/** Rotator / Mid videos per product per sprint (fixed). */
export const SOP_ROTATOR_VIDEOS_PER_PRODUCT = 2
export const SOP_MID_VIDEOS_PER_PRODUCT = 2

/**
 * Band A daily floor at the 30-video baseline ($5.00/day).
 * Scales linearly with dailyVolume / 30.
 */
export const SOP_BAND_A_DAILY_AT_30 = 5

/**
 * Band B daily floor at the 30-video baseline — exact $5/3 (not 1.67).
 * At 30/day × 3-day sprint → exactly $5.00 before hard floors.
 */
export const SOP_BAND_B_DAILY_AT_30 = 5 / 3

/** Commission-per-item threshold — fixed, does not scale with volume/sprint. */
export const SOP_COMMISSION_PER_ITEM_MIN = 2

/** High-ticket override — fixed (≥ $10/item with ≥ 1 sale → Band B minimum). */
export const SOP_HIGH_TICKET_COMMISSION_PER_ITEM = 10

/** Fixed hard floors (per sprint window) — not user-configurable. */
export const SOP_DEFAULT_BAND_A_FLOOR = 5
export const SOP_DEFAULT_BAND_B_FLOOR = 2

export interface SopBandFloorSettings {
  /** Hard floor for Band A sprint threshold (default $5). */
  bandAFloor: number
  /** Hard floor for Band B sprint threshold (default $2). */
  bandBFloor: number
}

export interface SopScalingInput {
  dailyVolume: number
  sprintDays: SprintDays
  floors?: Partial<SopBandFloorSettings>
}

export interface SopSlotBudgets {
  totalSlots: number
  anchorSlots: number
  rotatorSlots: number
  midSlots: number
  /** Remainder after Anchor + Rotator + Mid. */
  newSampleFillSlots: number
}

export interface SopProductBudgets {
  /** Anchor videos/product/sprint = sprintDays (daily all sprint long). */
  anchorVideosPerProduct: number
  rotatorVideosPerProduct: number
  midVideosPerProduct: number
  anchorProductCount: number
  rotatorProductCount: number
  midProductCount: number
}

export interface SopBandThresholds {
  dailyBandAFloor: number
  dailyBandBFloor: number
  /** After max(proportional, hard floor). */
  sprintBandAThreshold: number
  sprintBandBThreshold: number
  /** Proportional values before hard floors (for debugging / floor detection). */
  sprintBandAProportional: number
  sprintBandBProportional: number
  bandAFloorApplied: boolean
  bandBFloorApplied: boolean
  floors: SopBandFloorSettings
}

export interface SopScalingResult {
  dailyVolume: number
  sprintDays: SprintDays
  slots: SopSlotBudgets
  products: SopProductBudgets
  bands: SopBandThresholds
  /** Fixed qualification constants (not volume-scaled). */
  commissionPerItemMin: number
  highTicketCommissionPerItem: number
}

function assertPositiveVolume(dailyVolume: number): void {
  if (!Number.isFinite(dailyVolume) || dailyVolume < 1) {
    throw new Error(`dailyVolume must be >= 1, got ${dailyVolume}`)
  }
}

/**
 * Round down product count from a slot budget.
 * Minimum 1 product when the slot budget is > 0.
 */
export function sopProductCountFromSlots(
  slotBudget: number,
  videosPerProduct: number,
): number {
  if (slotBudget <= 0) return 0
  if (videosPerProduct < 1) {
    throw new Error(`videosPerProduct must be >= 1, got ${videosPerProduct}`)
  }
  return Math.max(1, Math.floor(slotBudget / videosPerProduct))
}

export function computeSopSlotBudgets(
  dailyVolume: number,
  sprintDays: SprintDays,
): SopSlotBudgets {
  assertPositiveVolume(dailyVolume)
  const totalSlots = dailyVolume * sprintDays
  const anchorSlots = Math.floor(
    (totalSlots * SOP_TOP_TIER_SLOT_SHARE_NUM) / SOP_TOP_TIER_SLOT_SHARE_DEN,
  )
  const rotatorSlots = Math.floor(
    (totalSlots * SOP_TOP_TIER_SLOT_SHARE_NUM) / SOP_TOP_TIER_SLOT_SHARE_DEN,
  )
  const midSlots = Math.floor(
    (totalSlots * SOP_MID_SLOT_SHARE_NUM) / SOP_MID_SLOT_SHARE_DEN,
  )
  const newSampleFillSlots = Math.max(
    0,
    totalSlots - anchorSlots - rotatorSlots - midSlots,
  )
  return {
    totalSlots,
    anchorSlots,
    rotatorSlots,
    midSlots,
    newSampleFillSlots,
  }
}

export function computeSopProductBudgets(
  slots: SopSlotBudgets,
  sprintDays: SprintDays,
): SopProductBudgets {
  const anchorVideosPerProduct = sprintDays
  return {
    anchorVideosPerProduct,
    rotatorVideosPerProduct: SOP_ROTATOR_VIDEOS_PER_PRODUCT,
    midVideosPerProduct: SOP_MID_VIDEOS_PER_PRODUCT,
    anchorProductCount: sopProductCountFromSlots(
      slots.anchorSlots,
      anchorVideosPerProduct,
    ),
    rotatorProductCount: sopProductCountFromSlots(
      slots.rotatorSlots,
      SOP_ROTATOR_VIDEOS_PER_PRODUCT,
    ),
    midProductCount: sopProductCountFromSlots(
      slots.midSlots,
      SOP_MID_VIDEOS_PER_PRODUCT,
    ),
  }
}

export function computeSopBandThresholds(
  dailyVolume: number,
  sprintDays: SprintDays,
  floors: Partial<SopBandFloorSettings> = {},
): SopBandThresholds {
  assertPositiveVolume(dailyVolume)
  const resolved: SopBandFloorSettings = {
    bandAFloor: floors.bandAFloor ?? SOP_DEFAULT_BAND_A_FLOOR,
    bandBFloor: floors.bandBFloor ?? SOP_DEFAULT_BAND_B_FLOOR,
  }

  const scale = dailyVolume / 30
  const dailyBandAFloor = SOP_BAND_A_DAILY_AT_30 * scale
  const dailyBandBFloor = SOP_BAND_B_DAILY_AT_30 * scale

  const sprintBandAProportional = dailyBandAFloor * sprintDays
  const sprintBandBProportional = dailyBandBFloor * sprintDays

  const sprintBandAThreshold = Math.max(resolved.bandAFloor, sprintBandAProportional)
  const sprintBandBThreshold = Math.max(resolved.bandBFloor, sprintBandBProportional)

  return {
    dailyBandAFloor,
    dailyBandBFloor,
    sprintBandAThreshold,
    sprintBandBThreshold,
    sprintBandAProportional,
    sprintBandBProportional,
    bandAFloorApplied: sprintBandAProportional < resolved.bandAFloor,
    bandBFloorApplied: sprintBandBProportional < resolved.bandBFloor,
    floors: resolved,
  }
}

/** Full scaling snapshot for a daily volume × sprint length. */
export function computeSopScaling(input: SopScalingInput): SopScalingResult {
  const { dailyVolume, sprintDays, floors } = input
  const slots = computeSopSlotBudgets(dailyVolume, sprintDays)
  const products = computeSopProductBudgets(slots, sprintDays)
  const bands = computeSopBandThresholds(dailyVolume, sprintDays, floors)
  return {
    dailyVolume,
    sprintDays,
    slots,
    products,
    bands,
    commissionPerItemMin: SOP_COMMISSION_PER_ITEM_MIN,
    highTicketCommissionPerItem: SOP_HIGH_TICKET_COMMISSION_PER_ITEM,
  }
}

/** Round money for display / table comparison (2 dp). */
export function roundSopMoney(value: number): number {
  return Math.round(value * 100) / 100
}
