/**
 * Caption-match retainer prototype — offline verification.
 * Usage: npx tsx scripts/verify-caption-match.ts
 */
import assert from 'node:assert/strict'
import {
  buildCaptionMatchSuggestions,
  CAPTION_MATCH_CONFIRM_SIMPLIFICATION,
  CAPTION_MATCH_DEMO_BRANDS,
  confirmCaptionSuggestion,
  dismissSuggestion,
  loadConfirmedCaptionIds,
  loadDismissedSuggestionIds,
  MOCK_CAPTION_POSTS,
  normalizeMatchText,
  resetCaptionMatchSuggestionHistory,
  stripCaptionMatchDemoDeals,
} from '../src/lib/pipeline/captionMatch'
import type { BrandDeal } from '../src/types/pipeline'

function deal(
  partial: Partial<BrandDeal> & Pick<BrandDeal, 'id' | 'brandName'>,
  completedCount = 0,
): BrandDeal {
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
      completed: i < completedCount,
    })),
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...partial,
  }
}

const AMBIGUOUS_ID = 'mock-cap-ambiguous'
const NOVA_CLEAR = 'mock-cap-novaglow-clear'
const SIP_CLEAR = 'mock-cap-sipwell-clear'

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

const ambiguousCaption = MOCK_CAPTION_POSTS.find((c) => c.id === AMBIGUOUS_ID)!
assert.ok(ambiguousCaption.caption.includes('NovaGlow'))
assert.ok(ambiguousCaption.caption.includes('SipWell Co'))

// --- Both active ---
{
  const both = buildCaptionMatchSuggestions(MOCK_CAPTION_POSTS, [nova, sip])
  console.log(
    '\n1) Both deals incomplete — suggestions:',
    both.map((s) => `${s.captionPostId} → ${s.brandName}`),
  )
  assert.ok(
    both.some((s) => s.captionPostId === NOVA_CLEAR && s.dealId === 'd-nova'),
    'NovaGlow clear caption → NovaGlow',
  )
  assert.ok(
    both.some((s) => s.captionPostId === SIP_CLEAR && s.dealId === 'd-sip'),
    'SipWell clear caption → SipWell',
  )
  assert.ok(
    !both.some((s) => s.captionPostId === AMBIGUOUS_ID),
    'ambiguous caption skipped when both deals incomplete',
  )
  console.log('   ✓ single-brand captions work; ambiguous skipped')
}

// --- Regression: NovaGlow fully filmed, SipWell still open ---
{
  const novaDone = deal(
    {
      id: 'd-nova',
      brandName: CAPTION_MATCH_DEMO_BRANDS.novaGlow.brandName,
      product: CAPTION_MATCH_DEMO_BRANDS.novaGlow.product,
    },
    4,
  )
  const sipOpen = deal({
    id: 'd-sip',
    brandName: CAPTION_MATCH_DEMO_BRANDS.sipWell.brandName,
    product: CAPTION_MATCH_DEMO_BRANDS.sipWell.product,
  })
  const afterNovaDone = buildCaptionMatchSuggestions([ambiguousCaption], [novaDone, sipOpen])
  console.log(
    '\n2) REGRESSION — NovaGlow checklist full, SipWell open, ambiguous caption only:',
    afterNovaDone,
  )
  assert.equal(
    afterNovaDone.length,
    0,
    'ambiguous caption must NOT become a SipWell-only popup when NovaGlow is fully filmed',
  )
  console.log('   ✓ ambiguous still skipped (was the live bug)')
}

// --- Same caption, only SipWell deal exists at all ---
{
  const sipOnly = buildCaptionMatchSuggestions([ambiguousCaption], [sip])
  console.log(
    '\n3) Only SipWell deal in list — ambiguous caption:',
    sipOnly.map((s) => s.brandName),
  )
  assert.equal(sipOnly.length, 1)
  assert.equal(sipOnly[0].dealId, 'd-sip')
  console.log('   ✓ single-deal list may match (only one brand exists to score)')
}

// --- NovaGlow paid_closed still counts for ambiguity ---
{
  const novaClosed = deal({
    id: 'd-nova',
    brandName: CAPTION_MATCH_DEMO_BRANDS.novaGlow.brandName,
    product: CAPTION_MATCH_DEMO_BRANDS.novaGlow.product,
    stage: 'paid_closed',
  })
  const hits = buildCaptionMatchSuggestions([ambiguousCaption], [novaClosed, sip])
  console.log('\n4) NovaGlow paid_closed + SipWell open — ambiguous:', hits)
  assert.equal(hits.length, 0, 'closed retainer still participates in ambiguity')
  console.log('   ✓ closed brand still blocks ambiguous single-match')
}

// --- Reload-style: only single-brand captions remain after dismissals ---
{
  const filtered = buildCaptionMatchSuggestions(MOCK_CAPTION_POSTS, [nova, sip], {
    dismissedIds: new Set([
      `${NOVA_CLEAR}::d-nova`,
      `${SIP_CLEAR}::d-sip`,
      'mock-cap-already-dismissed-seed::d-nova',
    ]),
  })
  console.log(
    '\n5) After dismissing all clear single-brand captions:',
    filtered.map((s) => s.captionPostId),
  )
  assert.ok(!filtered.some((s) => s.captionPostId === AMBIGUOUS_ID))
  assert.equal(filtered.length, 0, 'no popup left once singles are dismissed')
  console.log('   ✓ ambiguous never fills the queue')
}

// --- Reload multiple times with full mock set ---
{
  console.log('\n6) Reload simulation ×5 (both deals incomplete):')
  for (let i = 1; i <= 5; i++) {
    const round = buildCaptionMatchSuggestions(MOCK_CAPTION_POSTS, [nova, sip])
    const ambiguous = round.filter((s) => s.captionPostId === AMBIGUOUS_ID)
    const singles = round.filter((s) => s.captionPostId === NOVA_CLEAR || s.captionPostId === SIP_CLEAR)
    assert.equal(ambiguous.length, 0, `reload ${i}: ambiguous must be empty`)
    assert.ok(singles.length >= 2, `reload ${i}: both clear singles present`)
    console.log(
      `   reload ${i}: ambiguous=${ambiguous.length}, singles=${singles.map((s) => s.brandName).join(',')}`,
    )
  }
  console.log('   ✓ 5/5 reloads: ambiguous never pops; singles still work')
}

// --- Replay after checklists are full must still produce popups ---
{
  const novaDone = deal(
    {
      id: 'd-nova-old',
      brandName: CAPTION_MATCH_DEMO_BRANDS.novaGlow.brandName,
      product: CAPTION_MATCH_DEMO_BRANDS.novaGlow.product,
    },
    4,
  )
  const sipDone = deal(
    {
      id: 'd-sip-old',
      brandName: CAPTION_MATCH_DEMO_BRANDS.sipWell.brandName,
      product: CAPTION_MATCH_DEMO_BRANDS.sipWell.product,
      retainerTotalVideos: 3,
    },
    3,
  )
  const beforeReplay = buildCaptionMatchSuggestions(MOCK_CAPTION_POSTS, [novaDone, sipDone])
  assert.equal(
    beforeReplay.length,
    0,
    'fully filmed demo deals must not emit suggestions',
  )

  const stripped = stripCaptionMatchDemoDeals([novaDone, sipDone, deal({ id: 'keep', brandName: 'OtherCo' })])
  assert.equal(stripped.length, 1)
  assert.equal(stripped[0].brandName, 'OtherCo')

  const replayed = [
    ...stripped,
    deal({
      id: 'd-nova-fresh',
      brandName: CAPTION_MATCH_DEMO_BRANDS.novaGlow.brandName,
      product: CAPTION_MATCH_DEMO_BRANDS.novaGlow.product,
    }),
    deal({
      id: 'd-sip-fresh',
      brandName: CAPTION_MATCH_DEMO_BRANDS.sipWell.brandName,
      product: CAPTION_MATCH_DEMO_BRANDS.sipWell.product,
      retainerTotalVideos: 3,
    }),
  ]
  const afterReplay = buildCaptionMatchSuggestions(MOCK_CAPTION_POSTS, replayed)
  console.log(
    '\n7) REGRESSION — Replay after full checklists:',
    afterReplay.map((s) => `${s.captionPostId} → ${s.brandName}`),
  )
  assert.ok(
    afterReplay.some((s) => s.captionPostId === NOVA_CLEAR),
    'replay must restore NovaGlow popup',
  )
  assert.ok(
    afterReplay.some((s) => s.captionPostId === SIP_CLEAR),
    'replay must restore SipWell popup',
  )
  console.log('   ✓ strip + fresh seed restores popups')
}

// --- Back-to-back queue drain (same sitting, no remount) ---
{
  const memory = new Map<string, string>()
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value)
    },
    removeItem: (key) => {
      memory.delete(key)
    },
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  }

  resetCaptionMatchSuggestionHistory()

  const deals = [nova, sip]
  const readQueue = () =>
    buildCaptionMatchSuggestions(MOCK_CAPTION_POSTS, deals, {
      dismissedIds: loadDismissedSuggestionIds(),
      confirmedCaptionIds: loadConfirmedCaptionIds(),
    })

  let queue = readQueue()
  console.log(
    '\n8) BACK-TO-BACK — starting queue:',
    queue.map((s) => `${s.captionPostId}→${s.brandName}`),
  )
  assert.ok(queue.length >= 2, 'need 2+ pending suggestions to prove back-to-back')

  const seen: string[] = []
  let steps = 0
  while (queue.length > 0 && steps < 10) {
    const current = queue[0]
    seen.push(current.id)
    const remainingAfter = queue.length - 1
    console.log(
      `   step ${steps + 1}: act on ${current.captionPostId} (${current.brandName}); ${remainingAfter} remaining after`,
    )

    // Alternate confirm / decline like a real sitting
    if (steps % 2 === 0) {
      confirmCaptionSuggestion(current.captionPostId, current.id)
    } else {
      dismissSuggestion(current.id)
    }

    // Immediate re-read — next item must be available without remount/navigation
    const nextQueue = readQueue()
    if (remainingAfter > 0) {
      assert.ok(nextQueue.length > 0, 'next suggestion must appear immediately after act')
      assert.notEqual(
        nextQueue[0].id,
        current.id,
        'next suggestion must be a different item (queue advanced)',
      )
    } else {
      assert.equal(nextQueue.length, 0, 'queue empty after last act')
    }
    queue = nextQueue
    steps++
  }

  assert.ok(seen.length >= 2, 'drained at least 2 suggestions in one sitting')
  assert.equal(queue.length, 0, 'queue fully drained')
  console.log(`   ✓ drained ${seen.length} suggestions back-to-back in one sitting`)
}

console.log('\nverify-caption-match: PASS')

