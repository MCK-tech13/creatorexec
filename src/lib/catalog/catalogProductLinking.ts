import type { CatalogMergeRecord, CatalogProduct } from '../../types/productCatalog'
import type { TrialProgressEntry, TrialProgressStore } from '../schedule/trialProgressStorage'
import { trialStorageKey } from '../schedule/trialProgressStorage'
import {
  getUserDataSnapshot,
  updateCatalogMergeHistory,
  updateProductCatalog,
  updateTrialProgress,
} from '../supabase/dataStore'
import { scheduleCatalogMergeHistoryPersist, scheduleProductCatalogPersist, scheduleTrialProgressPersist } from '../supabase/sync'
import {
  loadProductCatalog,
  saveProductCatalog,
  allExternalIdsForProduct,
} from './productCatalogStorage'

export { allExternalIdsForProduct }

function nowIso(): string {
  return new Date().toISOString()
}

function money(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

export interface MergePreview {
  survivor: CatalogProduct
  absorbed: CatalogProduct[]
  combinedCommission: number
  combinedGmv: number
  combinedItemsSold: number
  combinedOrderCount: number
  videosFilmedMax: number
  videosFilmedParts: Array<{ displayName: string; videosFilmed: number }>
  linkedExternalIds: string[]
}

function catalogAsTrialProduct(product: CatalogProduct): { id: string; productId: string } {
  return {
    id: product.id,
    productId: product.externalProductId ?? 'manual',
  }
}

function videosFilmedFor(
  product: CatalogProduct,
  store: TrialProgressStore,
): number {
  return store[trialStorageKey(catalogAsTrialProduct(product))]?.videosFilmed ?? 0
}

/** Build confirm-dialog numbers without mutating state. */
export function previewCatalogProductMerge(
  selectedIds: string[],
  catalog: CatalogProduct[] = loadProductCatalog(),
  trial: TrialProgressStore = getUserDataSnapshot().trialProgress,
): MergePreview {
  const selected = selectedIds
    .map((id) => catalog.find((p) => p.id === id && !p.archivedAt))
    .filter((p): p is CatalogProduct => Boolean(p))

  if (selected.length < 2) {
    throw new Error('Select at least two products to merge.')
  }

  // Survivor = first selected (stable, user-controlled order).
  const survivor = selected[0]
  const absorbed = selected.slice(1)

  const videosFilmedParts = selected.map((product) => ({
    displayName: product.displayName,
    videosFilmed: videosFilmedFor(product, trial),
  }))

  const linkedExternalIds = [
    ...new Set(selected.flatMap((product) => allExternalIdsForProduct(product))),
  ]

  return {
    survivor,
    absorbed,
    combinedCommission: selected.reduce((sum, p) => sum + p.commission, 0),
    combinedGmv: selected.reduce((sum, p) => sum + p.gmv, 0),
    combinedItemsSold: selected.reduce((sum, p) => sum + p.itemsSold, 0),
    combinedOrderCount: selected.reduce((sum, p) => sum + p.orderCount, 0),
    videosFilmedMax: Math.max(0, ...videosFilmedParts.map((p) => p.videosFilmed)),
    videosFilmedParts,
    linkedExternalIds,
  }
}

export function formatMergeConfirmSummary(preview: MergePreview): {
  title: string
  bodyLines: string[]
} {
  const absorbedNames = preview.absorbed.map((p) => `“${p.displayName}”`).join(', ')
  const trialParts = preview.videosFilmedParts
    .map((p) => `${p.videosFilmed} on “${p.displayName}”`)
    .join(', ')

  return {
    title: 'Merge these products?',
    bodyLines: [
      `“${preview.survivor.displayName}” will keep the catalog record. ${absorbedNames} will be archived and linked into it.`,
      `Combined sales: ${money(preview.combinedCommission)} commission · ${money(preview.combinedGmv)} GMV · ${preview.combinedItemsSold} items · ${preview.combinedOrderCount} orders.`,
      `Videos filmed will be ${preview.videosFilmedMax} (higher of ${trialParts}) — not added together.`,
      `Future reports with TikTok IDs ${preview.linkedExternalIds.join(', ') || '(none yet)'} will update this one product.`,
      'You can undo this merge from the product list if you change your mind.',
    ],
  }
}

function saveCatalogAndTrial(
  catalog: CatalogProduct[],
  trial: TrialProgressStore,
  history: CatalogMergeRecord[],
): void {
  updateProductCatalog(catalog)
  scheduleProductCatalogPersist()
  updateTrialProgress(trial)
  scheduleTrialProgressPersist()
  updateCatalogMergeHistory(history)
  scheduleCatalogMergeHistoryPersist()
}

/**
 * Merge selected catalog products into the first selected survivor.
 * Sales sum; trial progress = max(); absorbed rows archived; TikTok IDs linked.
 */
export function mergeCatalogProducts(selectedIds: string[]): CatalogMergeRecord {
  const catalog = loadProductCatalog()
  const trial = { ...getUserDataSnapshot().trialProgress }
  const history = [...getUserDataSnapshot().catalogMergeHistory]
  const preview = previewCatalogProductMerge(selectedIds, catalog, trial)

  const beforeProducts = [preview.survivor, ...preview.absorbed].map((p) => ({ ...p }))
  const beforeTrial: CatalogMergeRecord['beforeTrial'] = {}
  for (const product of beforeProducts) {
    const key = trialStorageKey(catalogAsTrialProduct(product))
    if (trial[key]) beforeTrial[key] = { ...trial[key] }
  }

  const primaryExternal =
    preview.survivor.externalProductId ??
    preview.absorbed.map((p) => p.externalProductId).find(Boolean) ??
    null

  const linkedExternalIds = preview.linkedExternalIds.filter(
    (id) => id !== primaryExternal,
  )

  const survivorNext: CatalogProduct = {
    ...preview.survivor,
    externalProductId: primaryExternal,
    linkedExternalIds,
    gmv: preview.combinedGmv,
    commission: preview.combinedCommission,
    itemsSold: preview.combinedItemsSold,
    orderCount: preview.combinedOrderCount,
    isFavorite:
      preview.survivor.isFavorite || preview.absorbed.some((p) => p.isFavorite),
    inRotation:
      preview.survivor.inRotation || preview.absorbed.some((p) => p.inRotation),
    firstVideoDeadline:
      preview.survivor.firstVideoDeadline ??
      preview.absorbed.map((p) => p.firstVideoDeadline).find(Boolean) ??
      null,
    updatedAt: nowIso(),
  }

  const absorbedIds = new Set(preview.absorbed.map((p) => p.id))
  const nextCatalog = catalog.map((product) => {
    if (product.id === survivorNext.id) return survivorNext
    if (absorbedIds.has(product.id)) {
      return { ...product, archivedAt: nowIso(), inRotation: false, updatedAt: nowIso() }
    }
    return product
  })

  const survivorKey = trialStorageKey(catalogAsTrialProduct(survivorNext))
  const afterEntry: TrialProgressEntry = {
    videosFilmed: preview.videosFilmedMax,
    source: 'manual',
  }
  trial[survivorKey] = afterEntry
  for (const absorbed of preview.absorbed) {
    const key = trialStorageKey(catalogAsTrialProduct(absorbed))
    if (key !== survivorKey) delete trial[key]
  }

  const record: CatalogMergeRecord = {
    id: crypto.randomUUID(),
    createdAt: nowIso(),
    undoneAt: null,
    survivorId: survivorNext.id,
    survivorDisplayName: survivorNext.displayName,
    absorbedIds: preview.absorbed.map((p) => p.id),
    beforeProducts,
    beforeTrial,
    afterTrialVideosFilmed: preview.videosFilmedMax,
  }

  saveCatalogAndTrial(nextCatalog, trial, [record, ...history])
  return record
}

/** Restore catalog + trial from a merge record. */
export function undoCatalogProductMerge(mergeId: string): boolean {
  const catalog = loadProductCatalog()
  const trial = { ...getUserDataSnapshot().trialProgress }
  const history = [...getUserDataSnapshot().catalogMergeHistory]
  const index = history.findIndex((row) => row.id === mergeId && !row.undoneAt)
  if (index === -1) return false

  const record = history[index]
  const beforeById = new Map(record.beforeProducts.map((p) => [p.id, p]))

  const nextCatalog = catalog.map((product) => {
    const before = beforeById.get(product.id)
    return before ? { ...before } : product
  })

  // Ensure any absorbed row missing from live catalog is restored.
  for (const before of record.beforeProducts) {
    if (!nextCatalog.some((p) => p.id === before.id)) {
      nextCatalog.push({ ...before })
    }
  }

  for (const key of Object.keys(record.beforeTrial)) {
    trial[key] = { ...record.beforeTrial[key] }
  }
  // Drop survivor post-merge key if it wasn't present before.
  const survivorBefore = beforeById.get(record.survivorId)
  if (survivorBefore) {
    const survivorKey = trialStorageKey(catalogAsTrialProduct(survivorBefore))
    if (!(survivorKey in record.beforeTrial)) {
      delete trial[survivorKey]
    }
  }

  history[index] = { ...record, undoneAt: nowIso() }
  saveCatalogAndTrial(nextCatalog, trial, history)
  return true
}

export function loadCatalogMergeHistory(): CatalogMergeRecord[] {
  return getUserDataSnapshot().catalogMergeHistory
}

export function latestUndoableMerge(): CatalogMergeRecord | null {
  return (
    loadCatalogMergeHistory().find((row) => !row.undoneAt) ?? null
  )
}
