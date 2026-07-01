import type { BrandDeal, DealVideoDeliverable, FilmingChecklistItem } from '../../types/pipeline'

export function dealVideoTargetCount(deal: BrandDeal): number {
  return deal.isRetainer ? (deal.retainerTotalVideos ?? 0) : (deal.videosRequired ?? 0)
}

export function usesChecklistForVideoRows(deal: BrandDeal): boolean {
  return dealVideoTargetCount(deal) > 0
}

export function emptyDeliverable(): DealVideoDeliverable {
  return { id: crypto.randomUUID() }
}

export function getVideoDeliverableRows(deal: BrandDeal): {
  id: string
  label: string
  videoLink: string
  adCode: string
}[] {
  if (usesChecklistForVideoRows(deal)) {
    return deal.filmingChecklist.map((item, index) => ({
      id: item.id,
      label: `Video ${index + 1}`,
      videoLink: item.videoLink ?? '',
      adCode: item.adCode ?? '',
    }))
  }

  const deliverables =
    deal.videoDeliverables.length > 0 ? deal.videoDeliverables : [emptyDeliverable()]

  return deliverables.map((item, index) => ({
    id: item.id,
    label: `Video ${index + 1}`,
    videoLink: item.videoLink ?? '',
    adCode: item.adCode ?? '',
  }))
}

export function patchVideoRowField(
  deal: BrandDeal,
  rowId: string,
  field: 'videoLink' | 'adCode',
  value: string,
): Partial<BrandDeal> {
  const nextValue = value.trim() ? value : undefined

  if (usesChecklistForVideoRows(deal)) {
    return {
      filmingChecklist: deal.filmingChecklist.map((item) =>
        item.id === rowId ? { ...item, [field]: nextValue } : item,
      ),
    }
  }

  return {
    videoDeliverables: (deal.videoDeliverables.length > 0
      ? deal.videoDeliverables
      : [emptyDeliverable()]
    ).map((item) =>
      item.id === rowId ? { ...item, [field]: nextValue } : item,
    ),
  }
}

export function patchAddVideoRow(deal: BrandDeal): Partial<BrandDeal> {
  if (usesChecklistForVideoRows(deal)) {
    const nextCount = dealVideoTargetCount(deal) + 1
    return deal.isRetainer
      ? { retainerTotalVideos: nextCount }
      : { videosRequired: nextCount }
  }

  const deliverables =
    deal.videoDeliverables.length > 0 ? deal.videoDeliverables : [emptyDeliverable()]

  return {
    videoDeliverables: [...deliverables, emptyDeliverable()],
  }
}

export function patchRemoveVideoRow(deal: BrandDeal, rowId: string): Partial<BrandDeal> | null {
  if (usesChecklistForVideoRows(deal)) {
    if (deal.filmingChecklist.length <= 1) return null
    const index = deal.filmingChecklist.findIndex((item) => item.id === rowId)
    if (index === -1) return null
    const nextCount = dealVideoTargetCount(deal) - 1
    return deal.isRetainer
      ? { retainerTotalVideos: nextCount }
      : { videosRequired: nextCount }
  }

  if (deal.videoDeliverables.length <= 1) return null
  return {
    videoDeliverables: deal.videoDeliverables.filter((item) => item.id !== rowId),
  }
}

export function hasAnyVideoDeliverableData(deal: BrandDeal): boolean {
  if (usesChecklistForVideoRows(deal)) {
    return deal.filmingChecklist.some((item) => item.videoLink || item.adCode)
  }
  return deal.videoDeliverables.some((item) => item.videoLink || item.adCode)
}

export function firstVideoDeliverablePreview(deal: BrandDeal): {
  videoLink?: string
  adCode?: string
} {
  if (usesChecklistForVideoRows(deal)) {
    const item = deal.filmingChecklist.find((row) => row.videoLink || row.adCode)
    return { videoLink: item?.videoLink, adCode: item?.adCode }
  }
  const item = deal.videoDeliverables.find((row) => row.videoLink || row.adCode)
  return { videoLink: item?.videoLink, adCode: item?.adCode }
}

/** Migrate legacy top-level videoLink/adCode and ensure default row storage. */
export function normalizeDealVideoDeliverables(
  deal: BrandDeal & { videoLink?: string; adCode?: string },
): BrandDeal {
  let filmingChecklist: FilmingChecklistItem[] = deal.filmingChecklist ?? []
  let videoDeliverables: DealVideoDeliverable[] = deal.videoDeliverables ?? []

  const legacyLink = deal.videoLink
  const legacyCode = deal.adCode

  if (legacyLink || legacyCode) {
    if (filmingChecklist.length > 0) {
      filmingChecklist = filmingChecklist.map((item, index) =>
        index === 0
          ? {
              ...item,
              videoLink: item.videoLink ?? legacyLink,
              adCode: item.adCode ?? legacyCode,
            }
          : item,
      )
    } else if (videoDeliverables.length === 0) {
      videoDeliverables = [
        {
          id: crypto.randomUUID(),
          videoLink: legacyLink,
          adCode: legacyCode,
        },
      ]
    } else {
      videoDeliverables = videoDeliverables.map((item, index) =>
        index === 0
          ? {
              ...item,
              videoLink: item.videoLink ?? legacyLink,
              adCode: item.adCode ?? legacyCode,
            }
          : item,
      )
    }
  }

  if (videoDeliverables.length === 0 && dealVideoTargetCount(deal) === 0) {
    videoDeliverables = [emptyDeliverable()]
  }

  const { videoLink: _vl, adCode: _ac, ...rest } = deal
  return {
    ...rest,
    filmingChecklist,
    videoDeliverables,
  }
}
