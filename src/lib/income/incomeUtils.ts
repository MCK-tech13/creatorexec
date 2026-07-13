import {
  INCOME_SOURCES,
  type IncomeEntry,
  type IncomeSource,
  type IncomeTrackerStore,
} from '../../types/incomeTracker'

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export const EMPTY_INCOME_ENTRY: Omit<IncomeEntry, 'id' | 'monthKey'> = {
  source: 'TikTok Shop',
  note: null,
  gmvTotal: 0,
  estimatedCommission: 0,
  settledCommission: 0,
  brandDealsIncome: 0,
  bonusesRewards: 0,
}

export function createIncomeEntryId(): string {
  return crypto.randomUUID()
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function parseMonthKey(key: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key)
  if (!match) return null
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  if (month < 1 || month > 12) return null
  return { year, month }
}

export function formatMonthLabel(key: string): string {
  const parsed = parseMonthKey(key)
  if (!parsed) return key
  return new Date(parsed.year, parsed.month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function calcTotalIncome(entry: Pick<IncomeEntry, 'settledCommission' | 'brandDealsIncome' | 'bonusesRewards'>): number {
  return entry.settledCommission + entry.brandDealsIncome + entry.bonusesRewards
}

export function aggregateIncomeAmounts(entries: IncomeEntry[]): Pick<
  IncomeEntry,
  'gmvTotal' | 'estimatedCommission' | 'settledCommission' | 'brandDealsIncome' | 'bonusesRewards'
> {
  return entries.reduce(
    (totals, entry) => ({
      gmvTotal: totals.gmvTotal + entry.gmvTotal,
      estimatedCommission: totals.estimatedCommission + entry.estimatedCommission,
      settledCommission: totals.settledCommission + entry.settledCommission,
      brandDealsIncome: totals.brandDealsIncome + entry.brandDealsIncome,
      bonusesRewards: totals.bonusesRewards + entry.bonusesRewards,
    }),
    {
      gmvTotal: 0,
      estimatedCommission: 0,
      settledCommission: 0,
      brandDealsIncome: 0,
      bonusesRewards: 0,
    },
  )
}

export function totalsBySource(entries: IncomeEntry[]): Record<IncomeSource, number> {
  const totals = Object.fromEntries(INCOME_SOURCES.map((source) => [source, 0])) as Record<
    IncomeSource,
    number
  >

  for (const entry of entries) {
    totals[entry.source] += calcTotalIncome(entry)
  }

  return totals
}

export function getEntriesForMonth(store: IncomeTrackerStore, monthKeyValue: string): IncomeEntry[] {
  return store.filter((entry) => entry.monthKey === monthKeyValue)
}

export function monthKeysFromStore(store: IncomeTrackerStore): string[] {
  return sortMonthKeys([...new Set(store.map((entry) => entry.monthKey))])
}

export function sortMonthKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const pa = parseMonthKey(a)
    const pb = parseMonthKey(b)
    if (!pa || !pb) return a.localeCompare(b)
    if (pa.year !== pb.year) return pa.year - pb.year
    return pa.month - pb.month
  })
}

export function yearsFromStore(keys: string[]): number[] {
  const years = new Set<number>()
  for (const key of keys) {
    const parsed = parseMonthKey(key)
    if (parsed) years.add(parsed.year)
  }
  years.add(new Date().getFullYear())
  return [...years].sort((a, b) => b - a)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function parseMoneyInput(value: string): number {
  if (!value.trim()) return 0
  const n = parseFloat(value.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function moneyInputValue(amount: number): string {
  return amount === 0 ? '' : String(amount)
}

export function isIncomeSource(value: string): value is IncomeSource {
  return (INCOME_SOURCES as readonly string[]).includes(value)
}
