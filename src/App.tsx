import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from './components/layout/AppShell'
import { CsvUploadZone } from './components/upload/CsvUploadZone'
import { StatsCards } from './components/dashboard/StatsCards'
import { TierTabs } from './components/dashboard/TierTabs'
import { ProductTable } from './components/dashboard/ProductTable'
import { AddProductModal } from './components/dashboard/AddProductModal'
import { SprintConfigForm } from './components/config/SprintConfigForm'
import { FilmingSchedule } from './components/schedule/FilmingSchedule'
import type { DeadlineFormData } from './components/schedule/AddDeadlineModal'
import { parseCommissionFile, isParseError } from './lib/csv/parser'
import { tierProducts, computeScore } from './lib/analysis/tierEngine'
import { buildFilmingSchedule } from './lib/schedule/scheduleBuilder'
import { clearFilmingProgress } from './hooks/useFilmingProgress'
import type {
  AppStage,
  DaySchedule,
  DeadlineProduct,
  ManualProductFormData,
  MergedProduct,
  SprintConfig,
  Tier,
} from './types'

const DEFAULT_SPRINT_CONFIG: SprintConfig = {
  videosPerDay: 5,
  sprintDays: 7,
}

function App() {
  const [stage, setStage] = useState<AppStage>('upload')
  const [products, setProducts] = useState<MergedProduct[]>([])
  const [deadlineProducts, setDeadlineProducts] = useState<DeadlineProduct[]>([])
  const [excludedFromSchedule, setExcludedFromSchedule] = useState<Set<string>>(new Set())
  const [activeTier, setActiveTier] = useState<Tier | 'All'>('All')
  const [sprintConfig, setSprintConfig] = useState<SprintConfig>(DEFAULT_SPRINT_CONFIG)
  const [schedule, setSchedule] = useState<DaySchedule[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [showAddProductModal, setShowAddProductModal] = useState(false)

  const rebuildSchedule = useCallback(
    (
      productList: MergedProduct[],
      deadlines: DeadlineProduct[],
      config: SprintConfig,
      excluded: Set<string>,
    ) => {
      setSchedule(buildFilmingSchedule(productList, config, deadlines, excluded))
    },
    [],
  )

  const handleFileLoaded = useCallback(async (file: File) => {
    setIsProcessing(true)
    setError(null)
    setFileName(file.name)

    try {
      const result = await parseCommissionFile(file)
      if (isParseError(result)) {
        setError(result.message)
        setIsProcessing(false)
        return
      }

      const tiered = tierProducts(result.products)
      setProducts(tiered)
      setDeadlineProducts([])
      setExcludedFromSchedule(new Set())
      setActiveTier('All')
      setIsProcessing(false)
      setStage('dashboard')
    } catch {
      setError('Failed to read the file. Please try again.')
      setIsProcessing(false)
    }
  }, [])

  const retierPreservingManual = useCallback((updated: MergedProduct[]): MergedProduct[] => {
    const base = updated.map((p) => {
      const { score, tier, rankInTier, ...rest } = p
      return p.isManual ? { ...rest, tier } : rest
    })
    return tierProducts(base)
  }, [])

  const handleVideosFilmedChange = useCallback(
    (productId: string, videosFilmed: number) => {
      setProducts((prev) => {
        const updated = prev.map((p) =>
          p.id === productId ? { ...p, videosFilmed } : p,
        )
        const tiered = retierPreservingManual(updated)
        if (stage === 'schedule') {
          rebuildSchedule(tiered, deadlineProducts, sprintConfig, excludedFromSchedule)
        }
        return tiered
      })
    },
    [
      stage,
      rebuildSchedule,
      deadlineProducts,
      sprintConfig,
      excludedFromSchedule,
      retierPreservingManual,
    ],
  )

  const handleInRotationChange = useCallback(
    (productId: string, inRotation: boolean) => {
      setProducts((prev) => {
        const updated = prev.map((p) =>
          p.id === productId ? { ...p, inRotation } : p,
        )
        if (stage === 'schedule') {
          rebuildSchedule(updated, deadlineProducts, sprintConfig, excludedFromSchedule)
        }
        return updated
      })
    },
    [stage, rebuildSchedule, deadlineProducts, sprintConfig, excludedFromSchedule],
  )

  const handleAddManualProduct = useCallback(
    (data: ManualProductFormData) => {
      const newProduct: MergedProduct = {
        id: crypto.randomUUID(),
        productName: data.productName,
        productId: 'manual',
        gmv: 0,
        commission: data.commission,
        itemsSold: 0,
        orderCount: 0,
        videosFilmed: data.videosFilmed,
        score: computeScore(data.commission, 0, 0),
        tier: data.tier,
        rankInTier: 0,
        inRotation: true,
        isManual: true,
      }

      setProducts((prev) => {
        const combined = retierPreservingManual([...prev, newProduct])
        if (stage === 'schedule') {
          rebuildSchedule(combined, deadlineProducts, sprintConfig, excludedFromSchedule)
        }
        return combined
      })
    },
    [
      stage,
      rebuildSchedule,
      deadlineProducts,
      sprintConfig,
      excludedFromSchedule,
      retierPreservingManual,
    ],
  )

  const handleGenerateSchedule = () => {
    rebuildSchedule(products, deadlineProducts, sprintConfig, excludedFromSchedule)
    setStage('schedule')
  }

  const handleAddDeadline = useCallback(
    (data: DeadlineFormData) => {
      const newDeadline: DeadlineProduct = {
        id: crypto.randomUUID(),
        productName: data.productName,
        brand: data.brand,
        deadlineDate: data.deadlineDate,
        videosRequired: data.videosRequired,
        videosFilmed: data.videosFilmed,
      }
      setDeadlineProducts((prev) => {
        const next = [...prev, newDeadline]
        rebuildSchedule(products, next, sprintConfig, excludedFromSchedule)
        return next
      })
    },
    [products, rebuildSchedule, sprintConfig, excludedFromSchedule],
  )

  const handleRemoveFromSchedule = useCallback(
    (productKey: string) => {
      setExcludedFromSchedule((prev) => {
        const next = new Set(prev)
        next.add(productKey)
        rebuildSchedule(products, deadlineProducts, sprintConfig, next)
        return next
      })
    },
    [products, deadlineProducts, sprintConfig, rebuildSchedule],
  )

  const handleStartOver = () => {
    setStage('upload')
    setProducts([])
    setDeadlineProducts([])
    setExcludedFromSchedule(new Set())
    setSchedule([])
    setError(null)
    setFileName(null)
    setSprintConfig(DEFAULT_SPRINT_CONFIG)
    clearFilmingProgress()
  }

  return (
    <AppShell stage={stage}>
      {stage === 'upload' && (
        <div className="flex flex-col items-center fade-in">
          <CsvUploadZone onFileLoaded={handleFileLoaded} isProcessing={isProcessing} />
          {error && (
            <div className="mt-6 max-w-xl rounded-xl border border-tier-deadline/30 bg-tier-deadline/10 px-4 py-3 font-sans text-sm text-tier-deadline">
              {error}
            </div>
          )}
        </div>
      )}

      {stage === 'dashboard' && (
        <div className="space-y-6 fade-in">
          {fileName && (
            <p className="font-sans text-sm text-stone">
              Analyzed: <span className="text-ink">{fileName}</span>
            </p>
          )}
          <StatsCards products={products} />
          <TierTabs
            products={products}
            activeTier={activeTier}
            onTierChange={setActiveTier}
          />
          <ProductTable
            products={products}
            activeTier={activeTier}
            onVideosFilmedChange={handleVideosFilmedChange}
            onInRotationChange={handleInRotationChange}
          />
          <p className="font-sans text-xs text-stone">
            Products need 6+ videos filmed before low performers can move to Cut. Uncheck
            &quot;In Rotation&quot; to exclude a product from the sprint schedule.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddProductModal(true)}
              className="btn-outline-emerald inline-flex items-center gap-2 px-5 py-3 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Product Manually
            </button>
            <button
              type="button"
              onClick={() => setStage('config')}
              className="btn-primary px-6 py-3 text-sm"
            >
              Configure Sprint →
            </button>
          </div>
        </div>
      )}

      {stage === 'config' && (
        <SprintConfigForm
          config={sprintConfig}
          onChange={setSprintConfig}
          onSubmit={handleGenerateSchedule}
          onBack={() => setStage('dashboard')}
        />
      )}

      {stage === 'schedule' && (
        <FilmingSchedule
          schedule={schedule}
          products={products}
          onAddDeadline={handleAddDeadline}
          onRemoveFromSchedule={handleRemoveFromSchedule}
          onBack={() => setStage('config')}
          onStartOver={handleStartOver}
        />
      )}

      {showAddProductModal && (
        <AddProductModal
          onClose={() => setShowAddProductModal(false)}
          onSubmit={handleAddManualProduct}
        />
      )}
    </AppShell>
  )
}

export default App
