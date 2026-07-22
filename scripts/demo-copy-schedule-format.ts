/**
 * Before/after demo for Copy Schedule text formatting.
 * Usage: npx tsx scripts/demo-copy-schedule-format.ts
 */
import type { DaySchedule, ScheduledVideo } from '../src/types'
import { formatScheduleText } from '../src/lib/schedule/scheduleBuilder'
import { formatDeadlineCountdown } from '../src/lib/schedule/deadlineUtils'

function slot(
  partial: Omit<ScheduledVideo, 'suggestedAngle' | 'commission' | 'videosFilmed'> &
    Partial<Pick<ScheduledVideo, 'suggestedAngle' | 'commission' | 'videosFilmed'>>,
): ScheduledVideo {
  return {
    suggestedAngle: 'Demo',
    commission: 10,
    videosFilmed: 0,
    ...partial,
  }
}

/** Fixture shaped like a real full-mode day with duplicate product slots. */
const sampleSchedule: DaySchedule[] = [
  {
    day: 1,
    videos: [
      slot({
        slotId: 'd1-s1',
        productKey: 'leefar',
        productId: 'p1',
        productName: 'LEEFAR Her Juicy Feminine Probiotics Gummies',
        tier: 'Anchor',
        placementReason: 'Top seller — daily rotation',
      }),
      slot({
        slotId: 'd1-s2',
        productKey: 'tencoco',
        productId: 'p2',
        productName: 'Tencoco 51 Pcs Gel Nail Polish Kit',
        tier: 'Rising',
        placementReason: 'Proven performer — 2x this week',
      }),
      slot({
        slotId: 'd1-s3',
        productKey: 'goop',
        productId: 'p3',
        productName: 'Goop Microderm Exfoliator',
        tier: 'Test',
        videosFilmed: 1,
        placementReason: 'Trial video 2 of 6',
      }),
      slot({
        slotId: 'd1-s4',
        productKey: 'goop',
        productId: 'p3',
        productName: 'Goop Microderm Exfoliator',
        tier: 'Test',
        videosFilmed: 1,
        placementReason: 'Trial video 5 of 6',
      }),
      slot({
        slotId: 'd1-s5',
        productKey: 'retainer-x',
        productId: 'r1',
        productName: 'GlowCo — Retainer SKU',
        tier: 'Retainer',
        brand: 'GlowCo',
        placementReason: 'Retainer deliverable',
      }),
    ],
  },
  {
    day: 2,
    videos: [
      slot({
        slotId: 'd2-s1',
        productKey: 'leefar',
        productId: 'p1',
        productName: 'LEEFAR Her Juicy Feminine Probiotics Gummies',
        tier: 'Anchor',
        placementReason: 'Top seller — daily rotation',
      }),
      slot({
        slotId: 'd2-s2',
        productKey: 'sample',
        productId: 'p4',
        productName: 'Z:SEA Peptide Firming Neck Cream',
        tier: 'Test',
        deadlineDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        placementReason: 'First trial video — post by due in 2 days',
      }),
      slot({
        slotId: 'd2-s3',
        productKey: 'leefar',
        productId: 'p1',
        productName: 'LEEFAR Her Juicy Feminine Probiotics Gummies',
        tier: 'Anchor',
        placementReason: 'Top seller — daily rotation',
      }),
    ],
  },
]

/** Old one-line-per-slot format (for before/after comparison). */
function formatScheduleTextBefore(schedule: DaySchedule[]): string {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return schedule
    .map((day) => {
      const dayLabel = dayNames[(day.day - 1) % 7]
      const lines = day.videos.map((v) => {
        const countdown =
          v.deadlineDate != null ? ` (${formatDeadlineCountdown(v.deadlineDate)})` : ''
        return `  [${v.tier}] ${v.productName}${countdown} — ${v.placementReason ?? v.suggestedAngle}`
      })
      return `Day ${day.day} — ${dayLabel}\n${lines.join('\n')}`
    })
    .join('\n\n')
}

console.log('========== BEFORE (one line per slot) ==========')
console.log(formatScheduleTextBefore(sampleSchedule))
console.log('')
console.log('========== AFTER (grouped by product + count) ==========')
console.log(formatScheduleText(sampleSchedule))
console.log('')
