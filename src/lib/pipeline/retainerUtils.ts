import type { BrandDeal } from '../../types/pipeline'

export interface RetainerProgress {
  completed: number
  total: number
  remaining: number
  daysRemaining: number
  videosPerDay: number
  behindPace: boolean
}

export function countVideosCompleted(deal: BrandDeal): number {
  return deal.filmingChecklist.filter((item) => item.completed).length
}

export function syncFilmingChecklist(
  deal: BrandDeal,
  targetCount: number,
): BrandDeal['filmingChecklist'] {
  const count = Math.max(0, targetCount)
  const existing = deal.filmingChecklist
  if (existing.length === count) return existing
  if (existing.length > count) {
    return existing.slice(0, count)
  }
  const added = Array.from({ length: count - existing.length }, () => ({
    id: crypto.randomUUID(),
    completed: false,
  }))
  return [...existing, ...added]
}

function daysUntil(dateIso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateIso + 'T12:00:00')
  target.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

export function calcRetainerProgress(
  deal: BrandDeal,
  dailyPostingVolume: number,
): RetainerProgress | null {
  if (!deal.isRetainer) return null
  const total = deal.retainerTotalVideos ?? 0
  const completed = countVideosCompleted(deal)
  const remaining = Math.max(0, total - completed)
  const deadline = deal.retainerDeadlineDate
  if (!deadline || total <= 0) {
    return {
      completed,
      total,
      remaining,
      daysRemaining: 0,
      videosPerDay: 0,
      behindPace: false,
    }
  }
  const daysRemaining = Math.max(1, daysUntil(deadline))
  const videosPerDay = remaining > 0 ? Math.ceil(remaining / daysRemaining) : 0
  return {
    completed,
    total,
    remaining,
    daysRemaining,
    videosPerDay,
    behindPace: videosPerDay > dailyPostingVolume && remaining > 0,
  }
}

export function isActiveRetainer(deal: BrandDeal): boolean {
  if (!deal.isRetainer) return false
  if (deal.stage === 'paid_closed') return false
  const progress = countVideosCompleted(deal)
  const total = deal.retainerTotalVideos ?? 0
  return total > progress && Boolean(deal.retainerDeadlineDate)
}
