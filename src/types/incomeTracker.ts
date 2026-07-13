/** Allowed income sources for manual entries and imports. */
export const INCOME_SOURCES = [
  'TikTok Shop',
  'Meta Commission',
  'Trybe Commission',
  'Amazon Commission',
  'Other',
] as const

export type IncomeSource = (typeof INCOME_SOURCES)[number]

/** One manually tracked income line item. */
export interface IncomeEntry {
  id: string
  monthKey: string
  source: IncomeSource
  note: string | null
  gmvTotal: number
  estimatedCommission: number
  settledCommission: number
  brandDealsIncome: number
  bonusesRewards: number
}

export type IncomeTrackerStore = IncomeEntry[]
