import type { MergedProduct, ScheduleMode, SprintConfig, SprintDays } from '../../types'
import type { CatalogProduct } from '../../types/productCatalog'
import { tierProductsMomentum } from '../analysis/momentumMode'
import { tierProductsSopList } from '../analysis/sopTierAssign'
// Full `tierEngine.tierProducts` kept in-repo; not imported on user-reachable catalog path.
import { hydrateProductsTrialProgress } from '../schedule/trialProgress'
import { loadProductCatalog } from './productCatalogStorage'

const SENTINEL_EXTERNAL = new Set(['sample', 'manual', ''])

/**
 * User-facing default is SOP. Momentum is reserved for the silent low-data
 * fallback. Legacy `full` / `sample` coerce to `sop` (engines stay in repo).
 */
export function normalizeScheduleMode(mode: ScheduleMode | string | null | undefined): ScheduleMode {
  if (mode === 'momentum') return 'momentum'
  return 'sop'
}

/**
 * Persist `sop` without a DB enum migration yet: schedule_mode column stays
 * `full`/`momentum`, and sprint_config.analysisMode carries `sop`.
 */
export function scheduleModeForDbColumn(mode: ScheduleMode): 'full' | 'momentum' {
  return mode === 'momentum' ? 'momentum' : 'full'
}

export function embedAnalysisModeInSprintConfig(
  config: SprintConfig,
  mode: ScheduleMode,
): SprintConfig & { analysisMode?: 'sop' } {
  if (mode === 'sop') {
    return { ...config, analysisMode: 'sop' }
  }
  const { analysisMode: _drop, ...rest } = config as SprintConfig & {
    analysisMode?: string
  }
  return rest
}

export function scheduleModeFromPersisted(
  columnMode: unknown,
  sprintConfig: unknown,
): ScheduleMode {
  const config =
    sprintConfig && typeof sprintConfig === 'object'
      ? (sprintConfig as { analysisMode?: unknown })
      : {}
  if (columnMode === 'momentum') return 'momentum'
  if (config.analysisMode === 'sop') return 'sop'
  // Legacy full / missing analysisMode → SOP (only user-facing path).
  return 'sop'
}

function displayName(product: CatalogProduct): string {
  return product.brand ? `${product.displayName} (${product.brand})` : product.displayName
}

function externalOrSentinel(product: CatalogProduct): string {
  if (product.externalProductId && !SENTINEL_EXTERNAL.has(product.externalProductId)) {
    return product.externalProductId
  }
  // Keep a sentinel for non-TikTok rows so trialStorageKey prefers catalog UUID.
  return product.isManual || product.source === 'sample' || product.source === 'backfill'
    ? 'sample'
    : 'manual'
}

/** Map a durable catalog row into a pre-tier MergedProduct draft. */
export function mergedDraftFromCatalog(
  product: CatalogProduct,
): Omit<MergedProduct, 'score' | 'tier' | 'rankInTier'> {
  return {
    id: product.id,
    productName: displayName(product),
    productId: externalOrSentinel(product),
    gmv: product.gmv,
    commission: product.commission,
    itemsSold: product.itemsSold,
    orderCount: product.orderCount,
    videosFilmed: 0,
    inRotation: product.inRotation,
    // Force through assignTier so zero-sales land in Test (favorites included).
    isManual: false,
    isFavorite: product.isFavorite,
    firstVideoDeadline: product.firstVideoDeadline,
  }
}

export function activeCatalogProducts(
  catalog: CatalogProduct[] = loadProductCatalog(),
): CatalogProduct[] {
  return catalog.filter((product) => product.inRotation && !product.archivedAt)
}

/**
 * Build the sprint product list from the durable catalog.
 * Zero-metric rows run through tierEngine → Test; favorites stay Test with isFavorite.
 * Stage 3: CSV uploads reconcile into catalog, then sprint rebuilds from here.
 */
export function buildSprintProductsFromCatalog(
  catalog: CatalogProduct[] = loadProductCatalog(),
  options?: {
    hydrateTrial?: boolean
    mode?: ScheduleMode
    dailyVolume?: number
    sprintDays?: SprintDays
    floors?: Parameters<typeof tierProductsSopList>[1]['floors']
  },
): MergedProduct[] {
  const active = activeCatalogProducts(catalog)
  if (active.length === 0) return []

  const mode = normalizeScheduleMode(options?.mode)
  const byId = new Map(active.map((product) => [product.id, product]))
  const drafts = active.map(mergedDraftFromCatalog)

  // Full `tierProducts` remains in-repo but is not used on user-reachable paths.
  let ranked: MergedProduct[]
  if (mode === 'momentum') {
    ranked = tierProductsMomentum(drafts)
  } else {
    ranked = tierProductsSopList(drafts, {
      dailyVolume: options?.dailyVolume ?? 30,
      sprintDays: options?.sprintDays ?? 3,
      floors: options?.floors,
    })
  }

  const tiered = ranked.map((product) => {
    const source = byId.get(product.id)
    return {
      ...product,
      isManual: source?.isManual ?? product.isManual,
      isFavorite: source?.isFavorite ?? Boolean(product.isFavorite),
      firstVideoDeadline: source?.firstVideoDeadline ?? product.firstVideoDeadline,
    }
  })

  if (options?.hydrateTrial === false) return tiered
  return hydrateProductsTrialProgress(tiered)
}

/** Re-apply catalog favorite flags onto an in-sprint product list. */
export function enrichProductsWithCatalogFavorites(
  products: MergedProduct[],
  catalog: CatalogProduct[] = loadProductCatalog(),
): MergedProduct[] {
  if (products.length === 0 || catalog.length === 0) return products
  const byId = new Map(catalog.map((product) => [product.id, product]))
  return products.map((product) => {
    const match = byId.get(product.id)
    if (!match) return product
    return { ...product, isFavorite: match.isFavorite }
  })
}
