import type { DaySchedule } from '../../types'
import type { BrandDeal } from '../../types/pipeline'
import type { IncomeMonthEntry, IncomeTrackerStore } from '../../types/incomeTracker'
import type { ProductScoutEntry } from '../../types/productScout'
import { isActiveRetainer } from '../pipeline/retainerUtils'
import {
  calcTotalIncome,
  formatCurrency,
  formatMonthLabel,
  sortMonthKeys,
} from '../income/incomeUtils'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface SprintHomePreview {
  kind: 'setup' | 'preview'
  headline: string
  detail?: string
  upcomingDays?: { label: string; count: number }[]
}

export interface RetainerHomePreview {
  activeCount: number
  pipelineCount: number
  nextDeadlineLabel: string | null
}

export interface IncomeHomePreview {
  monthLabel: string | null
  gmv: number | null
  totalIncome: number | null
  estimatedCommission: number | null
}

export interface ProductScoutHomePreview {
  count: number
}

export function buildSprintHomePreview(options: {
  sprintOnboardingComplete: boolean
  hasProductData: boolean
  hasActiveRetainers: boolean
  schedule: DaySchedule[]
  productCount: number
  videosPerDay: number
}): SprintHomePreview {
  const {
    sprintOnboardingComplete,
    hasProductData,
    hasActiveRetainers,
    schedule,
    productCount,
    videosPerDay,
  } = options

  if (!sprintOnboardingComplete) {
    return {
      kind: 'setup',
      headline: 'Set up your sprint schedule',
      detail: 'Answer a few quick questions, then upload your commission report or add samples.',
    }
  }

  if (schedule.length > 0) {
    const upcomingDays = schedule.slice(0, 4).map((day) => ({
      label: `Day ${day.day} · ${DAY_NAMES[(day.day - 1) % 7]}`,
      count: day.videos.length,
    }))
    const todayCount = schedule[0]?.videos.length ?? 0
    return {
      kind: 'preview',
      headline: `${todayCount} video${todayCount === 1 ? '' : 's'} up next today`,
      detail: `${schedule.length}-day sprint · ${videosPerDay}/day capacity`,
      upcomingDays,
    }
  }

  if (hasProductData) {
    return {
      kind: 'preview',
      headline: `${productCount} product${productCount === 1 ? '' : 's'} analyzed`,
      detail: 'Continue to configure your filming schedule.',
    }
  }

  if (hasActiveRetainers) {
    return {
      kind: 'preview',
      headline: 'Retainer filming schedule ready',
      detail: 'Active retainer deals are synced to your sprint workflow.',
    }
  }

  return {
    kind: 'setup',
    headline: 'Set up your sprint schedule',
    detail: 'Upload a commission report, add samples, or connect retainer deals.',
  }
}

function daysUntil(dateIso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateIso}T12:00:00`)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDeadlineLabel(dateIso: string): string {
  const days = daysUntil(dateIso)
  if (days < 0) return 'Past due'
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

export function buildRetainerHomePreview(deals: BrandDeal[]): RetainerHomePreview {
  const activeRetainers = deals.filter(isActiveRetainer)
  const pipelineCount = deals.filter((deal) => deal.stage !== 'paid_closed').length

  const deadlineDates = deals
    .flatMap((deal) => [deal.deadlineDate, deal.retainerDeadlineDate])
    .filter((date): date is string => Boolean(date))
    .filter((date) => daysUntil(date) >= 0)
    .sort((a, b) => daysUntil(a) - daysUntil(b))

  return {
    activeCount: activeRetainers.length,
    pipelineCount,
    nextDeadlineLabel: deadlineDates[0] ? formatDeadlineLabel(deadlineDates[0]) : null,
  }
}

export function buildIncomeHomePreview(store: IncomeTrackerStore): IncomeHomePreview {
  const keys = sortMonthKeys(Object.keys(store))
  if (keys.length === 0) {
    return {
      monthLabel: null,
      gmv: null,
      totalIncome: null,
      estimatedCommission: null,
    }
  }

  const latestKey = keys[keys.length - 1]
  const entry: IncomeMonthEntry = store[latestKey]
  return {
    monthLabel: formatMonthLabel(latestKey),
    gmv: entry.gmvTotal,
    totalIncome: calcTotalIncome(entry),
    estimatedCommission: entry.estimatedCommission,
  }
}

export function buildProductScoutHomePreview(entries: ProductScoutEntry[]): ProductScoutHomePreview {
  return { count: entries.length }
}

export function formatIncomeSnapshot(preview: IncomeHomePreview): string | null {
  if (preview.monthLabel === null) return null
  const parts: string[] = []
  if (preview.gmv !== null && preview.gmv > 0) {
    parts.push(`${formatCurrency(preview.gmv)} GMV`)
  }
  if (preview.totalIncome !== null && preview.totalIncome > 0) {
    parts.push(`${formatCurrency(preview.totalIncome)} income`)
  } else if (preview.estimatedCommission !== null && preview.estimatedCommission > 0) {
    parts.push(`${formatCurrency(preview.estimatedCommission)} est. commission`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'No amounts logged yet'
}
