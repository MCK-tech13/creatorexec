import assert from 'node:assert/strict'
import {
  dayVideoOverage,
  filmingStorageKey,
  migrateFilmingProgressForMove,
  moveCollapsedProductDay,
} from '../src/lib/schedule/moveCollapsedRow'
import type { DaySchedule, ScheduledVideo } from '../src/types'

function slot(
  day: number,
  index: number,
  productKey: string,
  productName: string,
  tier: ScheduledVideo['tier'] = 'Rising',
): ScheduledVideo {
  return {
    slotId: `d${day}-s${index}-${productName}-${tier}`,
    productKey,
    productId: productKey,
    productName,
    tier,
    suggestedAngle: 'test',
    commission: 10,
    videosFilmed: 0,
  }
}

function baseSchedule(): DaySchedule[] {
  return [
    {
      day: 1,
      videos: [
        slot(1, 0, 'anchor-a', 'Anchor A', 'Anchor'),
        slot(1, 1, 'anchor-a', 'Anchor A', 'Anchor'),
        slot(1, 2, 'rising-b', 'Rising B'),
      ],
    },
    {
      day: 2,
      videos: [slot(2, 0, 'test-c', 'Test C', 'Test'), slot(2, 1, 'rising-b', 'Rising B')],
    },
    {
      day: 3,
      videos: [slot(3, 0, 'cut-d', 'Cut D', 'Cut')],
    },
  ]
}

// Move whole collapsed row (both Anchor A slots) from day 1 → day 2
{
  const next = moveCollapsedProductDay(baseSchedule(), 'anchor-a', 1, 2)
  assert.equal(next[0].videos.length, 1)
  assert.equal(next[0].videos[0].productKey, 'rising-b')
  assert.equal(next[1].videos.length, 4)
  const moved = next[1].videos.filter((v) => v.productKey === 'anchor-a')
  assert.equal(moved.length, 2)
  assert.ok(moved.every((v) => v.tier === 'Anchor'))
  assert.ok(moved.every((v) => v.slotId.startsWith('d2-')))
  assert.equal(next[2].videos.length, 1)
}

// No-op same day
{
  const schedule = baseSchedule()
  const next = moveCollapsedProductDay(schedule, 'anchor-a', 1, 1)
  assert.equal(next, schedule)
}

// Missing product no-op identity of other days
{
  const next = moveCollapsedProductDay(baseSchedule(), 'missing', 1, 2)
  assert.equal(next[0].videos.length, 3)
  assert.equal(next[1].videos.length, 2)
}

// Tiers unchanged on move
{
  const next = moveCollapsedProductDay(baseSchedule(), 'test-c', 2, 3)
  const moved = next[2].videos.find((v) => v.productKey === 'test-c')
  assert.equal(moved?.tier, 'Test')
}

// Filming progress migrates and merges
{
  const progress = {
    [filmingStorageKey(1, 'Rising B')]: 1,
    [filmingStorageKey(2, 'Rising B')]: 1,
  }
  const migrated = migrateFilmingProgressForMove(progress, 'Rising B', 1, 2)
  assert.equal(migrated[filmingStorageKey(2, 'Rising B')], 2)
  assert.equal(migrated[filmingStorageKey(1, 'Rising B')], undefined)
}

// Overage detection
{
  const over = dayVideoOverage(baseSchedule(), 2)
  assert.deepEqual(
    over.map((o) => o.day),
    [1],
  )
  assert.equal(over[0].count, 3)
  assert.equal(over[0].target, 2)
  assert.deepEqual(dayVideoOverage(baseSchedule(), 10), [])
}

console.log('verify:schedule-dnd-move OK')
