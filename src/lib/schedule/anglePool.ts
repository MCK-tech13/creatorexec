/** Shared content-angle pool rotated per product across schedule occurrences. */
export const CONTENT_ANGLE_POOL = [
  'New hook / cold open',
  'Use case / scenario',
  'Comparison (vs. another product, vs. going without it, before/after)',
  'Personal experience / storytime',
  'Direct demo / features (different setting/angle each time)',
] as const

export type ContentAngle = (typeof CONTENT_ANGLE_POOL)[number]

export function angleAtPoolIndex(index: number): ContentAngle {
  const normalized = ((index % CONTENT_ANGLE_POOL.length) + CONTENT_ANGLE_POOL.length) %
    CONTENT_ANGLE_POOL.length
  return CONTENT_ANGLE_POOL[normalized]
}
