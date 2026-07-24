import type { BrandDeal, BrandDealInsert } from '../../../types/pipeline'
import { CAPTION_MATCH_DEMO_BRANDS } from './mockCaptions'

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const DEMO_BRAND_NAMES_LOWER = new Set(
  Object.values(CAPTION_MATCH_DEMO_BRANDS).map((b) => b.brandName.toLowerCase()),
)

export function isCaptionMatchDemoBrand(brandName: string): boolean {
  return DEMO_BRAND_NAMES_LOWER.has(brandName.trim().toLowerCase())
}

/** BrandDealInsert rows for Preview caption-match walkthrough. */
export function buildCaptionMatchDemoDealInserts(): BrandDealInsert[] {
  return [
    {
      brandName: CAPTION_MATCH_DEMO_BRANDS.novaGlow.brandName,
      product: CAPTION_MATCH_DEMO_BRANDS.novaGlow.product,
      stage: 'filming',
      isRetainer: true,
      retainerTotalVideos: 4,
      retainerDeadlineDate: daysFromNow(14),
      contractSigned: true,
      notes: 'Caption-match demo deal (NovaGlow)',
    },
    {
      brandName: CAPTION_MATCH_DEMO_BRANDS.sipWell.brandName,
      product: CAPTION_MATCH_DEMO_BRANDS.sipWell.product,
      stage: 'filming',
      isRetainer: true,
      retainerTotalVideos: 3,
      retainerDeadlineDate: daysFromNow(10),
      contractSigned: true,
      notes: 'Caption-match demo deal (SipWell Co)',
    },
  ]
}

export function dealsMissingCaptionDemoBrands(deals: BrandDeal[]): BrandDealInsert[] {
  const existing = new Set(deals.map((d) => d.brandName.toLowerCase()))
  return buildCaptionMatchDemoDealInserts().filter(
    (d) => !existing.has(d.brandName.toLowerCase()),
  )
}

/**
 * Drop any prior NovaGlow/SipWell rows (even if fully filmed / non-retainer /
 * wrong stage) so Replay always restores matchable active retainers.
 */
export function stripCaptionMatchDemoDeals(deals: BrandDeal[]): BrandDeal[] {
  return deals.filter((d) => !isCaptionMatchDemoBrand(d.brandName))
}
