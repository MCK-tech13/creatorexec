/** One month of manually tracked income — keyed by "YYYY-MM" in storage. */
export interface IncomeMonthEntry {
  gmvTotal: number
  estimatedCommission: number
  settledCommission: number
  brandDealsIncome: number
  bonusesRewards: number
}

export type IncomeTrackerStore = Record<string, IncomeMonthEntry>
