/**
 * Caption-match retainer prototype — offline verification.
 * Usage: npx tsx scripts/verify-caption-match.ts
 */
import assert from 'node:assert/strict'
import {
  buildCaptionMatchSuggestions,
  CAPTION_MATCH_CONFIRM_SIMPLIFICATION,
  CAPTION_MATCH_DEMO_BRANDS,
  MOCK_CAPTION_POSTS,
  normalizeMatchText,
} from '../src/lib/pipeline/captionMatch'
import type { BrandDeal } from '../src/types/pipeline'

function deal(partial: Partial<BrandDeal> & Pick<BrandDeal, 'id' | 'brandName'>): BrandDeal {
  const total = partial.retainerTotalVideos ?? 4
  return {
    id: partial.id,
    brandName: partial.brandName,
    product: partial.product ?? '',
    stage: partial.stage ?? 'filming',
    contractSigned: true,
    videoDeliverables: [],
    isRetainer: true,
    retainerTotalVideos: total,
    retainerDeadlineDate: '2026-08-01',
    filmingChecklist: Array.from({ length: total }, (_, i) => ({
      id: `${partial.id}-v${i}`,
      completed: false,
    })),
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...partial,
  }
}

console.log('='.repeat(64))
console.log('Caption-match verification')
console.log('='.repeat(64))
console.log('Known simplification:', CAPTION_MATCH_CONFIRM_SIMPLIFICATION)

assert.equal(normalizeMatchText('Hello #NovaGlow!'), 'hello novaglow')

const nova = deal({
  id: 'd-nova',
  brandName: CAPTION_MATCH_DEMO_BRANDS.novaGlow.brandName,
  product: CAPTION_MATCH_DEMO_BRANDS.novaGlow.product,
})
const sip = deal({
  id: 'd-sip',
  brandName: CAPTION_MATCH_DEMO_BRANDS.sipWell.brandName,
  product: CAPTION_MATCH_DEMO_BRANDS.sipWell.product,
})

const both = buildCaptionMatchSuggestions(MOCK_CAPTION_POSTS, [nova, sip])
console.log(
  '\nSuggestions (both demo deals):',
  both.map((s) => ({ id: s.id, brand: s.brandName, confidence: s.confidence })),
)

// Clear NovaGlow hits should appear; ambiguous GRWM caption must be skipped
assert.ok(
  both.some((s) => s.captionPostId === 'mock-cap-novaglow-clear' && s.dealId === 'd-nova'),
  'NovaGlow clear caption → NovaGlow deal',
)
assert.ok(
  both.some((s) => s.captionPostId === 'mock-cap-sipwell-clear' && s.dealId === 'd-sip'),
  'SipWell clear caption → SipWell deal',
)
assert.ok(
  !both.some((s) => s.captionPostId === 'mock-cap-ambiguous'),
  'ambiguous caption skipped when both deals active',
)
assert.ok(
  !both.some((s) => s.captionPostId === 'mock-cap-no-match'),
  'unrelated caption skipped',
)

const novaOnly = buildCaptionMatchSuggestions(MOCK_CAPTION_POSTS, [nova])
assert.ok(
  novaOnly.some((s) => s.captionPostId === 'mock-cap-ambiguous' && s.dealId === 'd-nova'),
  'ambiguous caption can match when only one deal is active',
)

const dismissed = buildCaptionMatchSuggestions(MOCK_CAPTION_POSTS, [nova, sip], {
  dismissedIds: new Set(['mock-cap-novaglow-clear::d-nova']),
})
assert.ok(
  !dismissed.some((s) => s.captionPostId === 'mock-cap-novaglow-clear'),
  'dismissed suggestion filtered',
)

const confirmed = buildCaptionMatchSuggestions(MOCK_CAPTION_POSTS, [nova, sip], {
  confirmedCaptionIds: new Set(['mock-cap-sipwell-clear']),
})
assert.ok(
  !confirmed.some((s) => s.captionPostId === 'mock-cap-sipwell-clear'),
  'confirmed caption filtered',
)

console.log('\n✓ matcher: clear hits, ambiguous skip, dismiss/confirm filters')
console.log('verify-caption-match: PASS')
