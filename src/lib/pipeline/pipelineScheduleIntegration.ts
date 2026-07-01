import type { BrandDeal } from '../../types/pipeline'
import type { DeadlineProduct, RetainerScheduleEntry, ScheduledVideo, SprintConfig } from '../../types'
import { countVideosCompleted, calcRetainerProgress, isActiveRetainer } from './retainerUtils'
import { formatScheduleProductName } from '../schedule/scheduleDisplay'

const RETAINER_ANGLE = 'Retainer deliverable — brand partnership content'

export function dealsToPipelineDeadlines(deals: BrandDeal[]): DeadlineProduct[] {
  return deals
    .filter(
      (d) =>
        !d.isRetainer &&
        d.stage === 'filming' &&
        Boolean(d.deadlineDate?.trim()),
    )
    .map((d) => ({
      id: `pipeline-deal:${d.id}`,
      productName: d.product.trim() || d.brandName,
      brand: d.brandName,
      deadlineDate: d.deadlineDate!,
      videosRequired: Math.max(1, d.videosRequired ?? 1),
      videosFilmed: countVideosCompleted(d),
    }))
}

export function buildRetainerScheduleEntries(
  deals: BrandDeal[],
  _config: SprintConfig,
  dailyPostingVolume: number,
): RetainerScheduleEntry[] {
  const entries: RetainerScheduleEntry[] = []

  for (const deal of deals) {
    if (!isActiveRetainer(deal)) continue
    const progress = calcRetainerProgress(deal, dailyPostingVolume)
    if (!progress || progress.videosPerDay <= 0) continue

    entries.push({
      dealId: deal.id,
      brandName: deal.brandName,
      productName: deal.product.trim() || deal.brandName,
      slotsPerDay: progress.videosPerDay,
      deadlineDate: deal.retainerDeadlineDate!,
      videosFilmed: progress.completed,
    })
  }

  return entries
}

export function buildRetainerVideos(
  entries: RetainerScheduleEntry[],
  sprintDays: number,
): ScheduledVideo[] {
  const videos: ScheduledVideo[] = []

  for (const entry of entries) {
    for (let day = 0; day < sprintDays; day++) {
      for (let slot = 0; slot < entry.slotsPerDay; slot++) {
        videos.push({
          slotId: '',
          productKey: `retainer:${entry.dealId}`,
          productId: `retainer:${entry.dealId}`,
          productName: formatScheduleProductName(`${entry.brandName} — ${entry.productName}`),
          tier: 'Retainer',
          suggestedAngle: RETAINER_ANGLE,
          commission: 0,
          videosFilmed: entry.videosFilmed,
          deadlineDate: entry.deadlineDate,
          brand: entry.brandName,
        })
      }
    }
  }

  return videos
}

export function mergeDeadlineProducts(
  manual: DeadlineProduct[],
  fromPipeline: DeadlineProduct[],
): DeadlineProduct[] {
  const seen = new Set(manual.map((d) => d.id))
  const merged = [...manual]
  for (const item of fromPipeline) {
    if (!seen.has(item.id)) {
      merged.push(item)
      seen.add(item.id)
    }
  }
  return merged.sort(
    (a, b) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime(),
  )
}
