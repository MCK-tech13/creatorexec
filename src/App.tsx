import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from './components/layout/AppShell'
import { OnboardingQuiz } from './components/onboarding/OnboardingQuiz'
import { WelcomeScreen } from './components/onboarding/WelcomeScreen'
import { CsvUploadZone } from './components/upload/CsvUploadZone'
import { SampleModeScreen } from './components/sample/SampleModeScreen'
import { MomentumModeScreen } from './components/momentum/MomentumModeScreen'
import { MomentumModePromptModal } from './components/momentum/MomentumModePromptModal'
import { StatsCards } from './components/dashboard/StatsCards'
import { TierTabs } from './components/dashboard/TierTabs'
import { ProductTable } from './components/dashboard/ProductTable'
import { AddProductModal } from './components/dashboard/AddProductModal'
import { SprintConfigForm } from './components/config/SprintConfigForm'
import { FilmingSchedule } from './components/schedule/FilmingSchedule'
import type { DeadlineFormData } from './components/schedule/AddDeadlineModal'
import { parseCommissionFile, isParseError } from './lib/csv/parser'
import { tierProducts, computeScore } from './lib/analysis/tierEngine'
import {
  formatTopEarnerLine,
  retierProductsForMode,
  shouldSuggestMomentumMode,
  tierProductsMomentum,
} from './lib/analysis/momentumMode'
import { buildFilmingSchedule } from './lib/schedule/scheduleBuilder'
import { buildMomentumModeSchedule } from './lib/schedule/momentumModeSchedule'
import {
  buildSampleModeSchedule,
  sampleProductsToMerged,
} from './lib/schedule/sampleModeSchedule'
import { clearFilmingProgress } from './hooks/useFilmingProgress'
import {
  clearOnboardingProfile,
  loadOnboardingProfile,
  saveOnboardingProfile,
  updateUserMode,
} from './lib/onboarding/storage'
import {
  clearWelcomeSeen,
  isWelcomeSeen,
  markWelcomeSeen,
} from './lib/onboarding/welcomeStorage'
import type {
  AppStage,
  DaySchedule,
  DeadlineProduct,
  ManualProductFormData,
  MergedProduct,
  SampleProduct,
  ScheduleMode,
  SprintConfig,
  Tier,
} from './types'
import type { OnboardingProfile, UserMode } from './types/onboarding'

function initialSprintConfig(): SprintConfig {
  const stored = loadOnboardingProfile()?.videosPerDay
  return {
    videosPerDay: stored && stored >= 1 ? stored : 5,
    sprintDays: 7,
  }
}

function initialWelcomeSeen(): boolean {
  if (isWelcomeSeen()) return true
  if (loadOnboardingProfile() !== null) {
    markWelcomeSeen()
    return true
  }
  return false
}

function buildScheduleForMode(
  mode: ScheduleMode,
  products: MergedProduct[],
  config: SprintConfig,
  deadlines: DeadlineProduct[],
  excluded: Set<string>,
): DaySchedule[] {
  if (mode === 'sample') {
    return buildSampleModeSchedule(products, config)
  }
  if (mode === 'momentum') {
    return buildMomentumModeSchedule(products, config, deadlines, excluded)
  }
  return buildFilmingSchedule(products, config, deadlines, excluded)
}

function App() {
  const [welcomeSeen, setWelcomeSeen] = useState(initialWelcomeSeen)
  const [onboardingComplete, setOnboardingComplete] = useState(
    () => loadOnboardingProfile() !== null,
  )
  const [userMode, setUserMode] = useState<UserMode>(
    () => loadOnboardingProfile()?.mode ?? 'beginner',
  )
  const [stage, setStage] = useState<AppStage>('upload')
  const [products, setProducts] = useState<MergedProduct[]>([])
  const [deadlineProducts, setDeadlineProducts] = useState<DeadlineProduct[]>([])
  const [excludedFromSchedule, setExcludedFromSchedule] = useState<Set<string>>(new Set())
  const [activeTier, setActiveTier] = useState<Tier | 'All'>('All')
  const [sprintConfig, setSprintConfig] = useState<SprintConfig>(initialSprintConfig)
  const [schedule, setSchedule] = useState<DaySchedule[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('full')
  const [sampleProducts, setSampleProducts] = useState<SampleProduct[]>([])
  const [pendingProducts, setPendingProducts] = useState<MergedProduct[] | null>(null)
  const [showMomentumPrompt, setShowMomentumPrompt] = useState(false)

  const isBeginnerMode = userMode === 'beginner'
  const isSampleMode = scheduleMode === 'sample'
  const isMomentumMode = scheduleMode === 'momentum'

  const rebuildSchedule = useCallback(
    (
      productList: MergedProduct[],
      deadlines: DeadlineProduct[],
      config: SprintConfig,
      excluded: Set<string>,
      mode: ScheduleMode,
    ) => {
      setSchedule(buildScheduleForMode(mode, productList, config, deadlines, excluded))
    },
    [],
  )

  const retierPreservingManual = useCallback(
    (updated: MergedProduct[], mode: ScheduleMode): MergedProduct[] => {
      if (mode === 'sample') {
        return updated
      }
      const base = updated.map((p) => {
        if (p.isManual) {
          return { ...p }
        }
        const { score, tier, rankInTier, ...rest } = p
        return rest
      })
      if (mode === 'momentum') {
        return tierProductsMomentum(base)
      }
      return tierProducts(base)
    },
    [],
  )

  const finishUpload = useCallback(
    (tiered: MergedProduct[], mode: ScheduleMode) => {
      setProducts(tiered)
      setScheduleMode(mode)
      setSampleProducts([])
      setDeadlineProducts([])
      setExcludedFromSchedule(new Set())
      setActiveTier('All')
      setIsProcessing(false)
      setStage('dashboard')
    },
    [],
  )

  const handleWelcomeContinue = useCallback(() => {
    markWelcomeSeen()
    setWelcomeSeen(true)
  }, [])

  const handleOnboardingComplete = useCallback((profile: OnboardingProfile) => {
    saveOnboardingProfile(profile)
    setUserMode(profile.mode)
    setSprintConfig((prev) => ({ ...prev, videosPerDay: profile.videosPerDay }))
    setOnboardingComplete(true)
    setStage('upload')
  }, [])

  const handleSwitchToAdvanced = useCallback(() => {
    setUserMode('advanced')
    updateUserMode('advanced')
  }, [])

  const handleResetOnboarding = useCallback(() => {
    clearOnboardingProfile()
    clearWelcomeSeen()
    setWelcomeSeen(false)
    setOnboardingComplete(false)
    setUserMode('beginner')
    setStage('upload')
    setProducts([])
    setDeadlineProducts([])
    setExcludedFromSchedule(new Set())
    setSchedule([])
    setError(null)
    setFileName(null)
    setSprintConfig({ videosPerDay: 5, sprintDays: 7 })
    setActiveTier('All')
    clearFilmingProgress()
    setScheduleMode('full')
    setSampleProducts([])
    setPendingProducts(null)
    setShowMomentumPrompt(false)
  }, [])

  const handleFileLoaded = useCallback(
    async (file: File, options?: { fromMomentumEntry?: boolean }) => {
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

        const fullTiered = tierProducts(result.products)

        if (options?.fromMomentumEntry) {
          finishUpload(tierProductsMomentum(result.products), 'momentum')
          return
        }

        if (shouldSuggestMomentumMode(fullTiered)) {
          setPendingProducts(fullTiered)
          setShowMomentumPrompt(true)
          setIsProcessing(false)
          return
        }

        finishUpload(fullTiered, 'full')
      } catch {
        setError('Failed to read the file. Please try again.')
        setIsProcessing(false)
      }
    },
    [finishUpload],
  )

  const handleMomentumPromptConfirm = useCallback(() => {
    if (!pendingProducts) return
    const inputs = pendingProducts.map((p) => {
      const { score, tier, rankInTier, ...rest } = p
      return rest
    })
    finishUpload(tierProductsMomentum(inputs), 'momentum')
    setPendingProducts(null)
    setShowMomentumPrompt(false)
  }, [pendingProducts, finishUpload])

  const handleMomentumPromptDecline = useCallback(() => {
    if (!pendingProducts) return
    finishUpload(pendingProducts, 'full')
    setPendingProducts(null)
    setShowMomentumPrompt(false)
  }, [pendingProducts, finishUpload])

  const handleSwitchScheduleMode = useCallback(
    (mode: 'full' | 'momentum') => {
      if (scheduleMode === 'sample' || scheduleMode === mode) return
      setScheduleMode(mode)
      setProducts((prev) => {
        const tiered = retierProductsForMode(prev, mode)
        if (stage === 'schedule') {
          rebuildSchedule(
            tiered,
            deadlineProducts,
            sprintConfig,
            excludedFromSchedule,
            mode,
          )
        }
        return tiered
      })
    },
    [
      scheduleMode,
      stage,
      rebuildSchedule,
      deadlineProducts,
      sprintConfig,
      excludedFromSchedule,
    ],
  )

  const handleVideosFilmedChange = useCallback(
    (productId: string, videosFilmed: number) => {
      setProducts((prev) => {
        const updated = prev.map((p) =>
          p.id === productId ? { ...p, videosFilmed } : p,
        )
        const tiered = retierPreservingManual(updated, scheduleMode)
        if (stage === 'schedule') {
          rebuildSchedule(
            tiered,
            deadlineProducts,
            sprintConfig,
            excludedFromSchedule,
            scheduleMode,
          )
        }
        return tiered
      })
    },
    [
      stage,
      scheduleMode,
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
          rebuildSchedule(
            updated,
            deadlineProducts,
            sprintConfig,
            excludedFromSchedule,
            scheduleMode,
          )
        }
        return updated
      })
    },
    [
      stage,
      scheduleMode,
      rebuildSchedule,
      deadlineProducts,
      sprintConfig,
      excludedFromSchedule,
    ],
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
        const combined = retierPreservingManual([...prev, newProduct], scheduleMode)
        if (stage === 'schedule') {
          rebuildSchedule(
            combined,
            deadlineProducts,
            sprintConfig,
            excludedFromSchedule,
            scheduleMode,
          )
        }
        return combined
      })
    },
    [
      stage,
      scheduleMode,
      rebuildSchedule,
      deadlineProducts,
      sprintConfig,
      excludedFromSchedule,
      retierPreservingManual,
    ],
  )

  const handleGenerateSchedule = () => {
    rebuildSchedule(
      products,
      deadlineProducts,
      sprintConfig,
      excludedFromSchedule,
      scheduleMode,
    )
    setStage('schedule')
  }

  const handleEnterSampleMode = useCallback(() => {
    setError(null)
    setScheduleMode('full')
    setProducts([])
    setSampleProducts([])
    setSchedule([])
    setFileName(null)
    setStage('sample')
  }, [])

  const handleEnterMomentumMode = useCallback(() => {
    setError(null)
    setScheduleMode('full')
    setProducts([])
    setSampleProducts([])
    setSchedule([])
    setFileName(null)
    setStage('momentum')
  }, [])

  const handleSampleBuildSchedule = useCallback((items: SampleProduct[]) => {
    setSampleProducts(items)
    setProducts(sampleProductsToMerged(items))
    setScheduleMode('sample')
    setDeadlineProducts([])
    setExcludedFromSchedule(new Set())
    setStage('config')
  }, [])

  const handleUploadReport = useCallback(() => {
    setScheduleMode('full')
    setProducts([])
    setSampleProducts([])
    setDeadlineProducts([])
    setExcludedFromSchedule(new Set())
    setSchedule([])
    setError(null)
    setFileName(null)
    setStage('upload')
    clearFilmingProgress()
  }, [])

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
        rebuildSchedule(products, next, sprintConfig, excludedFromSchedule, scheduleMode)
        return next
      })
    },
    [products, rebuildSchedule, sprintConfig, excludedFromSchedule, scheduleMode],
  )

  const handleRemoveFromSchedule = useCallback(
    (productKey: string) => {
      setExcludedFromSchedule((prev) => {
        const next = new Set(prev)
        next.add(productKey)
        rebuildSchedule(products, deadlineProducts, sprintConfig, next, scheduleMode)
        return next
      })
    },
    [products, deadlineProducts, sprintConfig, rebuildSchedule, scheduleMode],
  )

  const handleStartOver = () => {
    setStage('upload')
    setProducts([])
    setDeadlineProducts([])
    setExcludedFromSchedule(new Set())
    setSchedule([])
    setError(null)
    setFileName(null)
    setScheduleMode('full')
    setSampleProducts([])
    setPendingProducts(null)
    setShowMomentumPrompt(false)
    setSprintConfig((prev) => ({
      videosPerDay: loadOnboardingProfile()?.videosPerDay ?? prev.videosPerDay,
      sprintDays: 7,
    }))
    clearFilmingProgress()
  }

  const topEarnerLine = isMomentumMode ? formatTopEarnerLine(products) : null

  if (!welcomeSeen) {
    return <WelcomeScreen onContinue={handleWelcomeContinue} />
  }

  if (!onboardingComplete) {
    return <OnboardingQuiz onComplete={handleOnboardingComplete} />
  }

  return (
    <AppShell stage={stage} onResetOnboarding={handleResetOnboarding}>
      {stage === 'upload' && (
        <div className="fade-in">
          <CsvUploadZone
            onFileLoaded={(file) => handleFileLoaded(file)}
            onEnterSampleMode={handleEnterSampleMode}
            onEnterMomentumMode={handleEnterMomentumMode}
            isProcessing={isProcessing}
          />
          {error && (
            <div className="mx-auto mt-6 max-w-xl border border-border-warm px-6 py-4 font-body text-sm text-stone">
              {error}
            </div>
          )}
        </div>
      )}

      {stage === 'sample' && (
        <SampleModeScreen
          initialProducts={sampleProducts}
          onBuildSchedule={handleSampleBuildSchedule}
          onBack={() => setStage('upload')}
        />
      )}

      {stage === 'momentum' && (
        <div className="fade-in">
          <MomentumModeScreen
            onFileLoaded={(file) => handleFileLoaded(file, { fromMomentumEntry: true })}
            onBack={() => setStage('upload')}
            isProcessing={isProcessing}
          />
          {error && (
            <div className="mx-auto mt-6 max-w-xl border border-border-warm px-6 py-4 font-body text-sm text-stone">
              {error}
            </div>
          )}
        </div>
      )}

      {stage === 'dashboard' && (
        <div className="space-y-8 fade-in">
          {fileName && (
            <p className="font-body text-sm font-medium text-emerald">Report analyzed ✓</p>
          )}
          {isMomentumMode && (
            <div className="border border-blush/40 bg-blush-tint px-6 py-5">
              <p className="font-body text-base text-ink">
                You&apos;re in Momentum Mode. Keep filming consistently and your top products
                will surface over time. Upload a new report each sprint to track your progress.
              </p>
            </div>
          )}
          {isBeginnerMode && !isMomentumMode && (
            <div className="border-t-2 border-emerald pt-6">
              <p className="font-body text-base leading-relaxed text-stone">
                Here are your products ranked by performance. Your top earners are highlighted
                in bold.
              </p>
            </div>
          )}
          <StatsCards products={products} />
          {topEarnerLine && (
            <p className="font-body text-base text-stone">{topEarnerLine}</p>
          )}
          <div className="mt-16">
            <TierTabs
              products={products}
              activeTier={activeTier}
              onTierChange={setActiveTier}
            />
          </div>
          <ProductTable
            products={products}
            activeTier={activeTier}
            beginnerMode={isBeginnerMode && !isMomentumMode}
            onVideosFilmedChange={handleVideosFilmedChange}
            onInRotationChange={handleInRotationChange}
          />
          {!isBeginnerMode && !isMomentumMode && (
            <p className="font-body text-xs text-stone">
              Products need 6+ videos filmed before low performers can move to Cut. Uncheck
              &quot;In Rotation&quot; to exclude a product from the sprint schedule.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowAddProductModal(true)}
              className="btn-secondary inline-flex items-center gap-2 px-5 py-3 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Product Manually
            </button>
            <button
              type="button"
              onClick={() => setStage('config')}
              className="btn-primary px-8 py-3 text-sm"
            >
              Configure Sprint →
            </button>
          </div>
          {!isSampleMode && (
            <p className="text-center">
              {isMomentumMode ? (
                <button
                  type="button"
                  onClick={() => handleSwitchScheduleMode('full')}
                  className="link-elegant font-body text-sm text-emerald"
                >
                  Switch to Full Mode
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSwitchScheduleMode('momentum')}
                  className="link-elegant font-body text-sm text-emerald"
                >
                  Switch to Momentum Mode
                </button>
              )}
            </p>
          )}
          {isBeginnerMode && !isMomentumMode && (
            <p className="text-center">
              <button
                type="button"
                onClick={handleSwitchToAdvanced}
                className="link-elegant font-body text-sm text-stone"
              >
                Switch to Advanced Mode
              </button>
            </p>
          )}
        </div>
      )}

      {stage === 'config' && (
        <SprintConfigForm
          config={sprintConfig}
          onChange={setSprintConfig}
          onSubmit={handleGenerateSchedule}
          onBack={() => setStage(isSampleMode ? 'sample' : 'dashboard')}
        />
      )}

      {stage === 'schedule' && (
        <FilmingSchedule
          schedule={schedule}
          products={products}
          beginnerMode={isBeginnerMode && !isMomentumMode}
          sampleMode={isSampleMode}
          momentumMode={isMomentumMode}
          onAddDeadline={handleAddDeadline}
          onRemoveFromSchedule={handleRemoveFromSchedule}
          onBack={() => setStage('config')}
          onStartOver={handleStartOver}
          onUploadReport={isSampleMode ? handleUploadReport : undefined}
        />
      )}

      {showAddProductModal && (
        <AddProductModal
          onClose={() => setShowAddProductModal(false)}
          onSubmit={handleAddManualProduct}
        />
      )}

      {showMomentumPrompt && (
        <MomentumModePromptModal
          onConfirm={handleMomentumPromptConfirm}
          onDecline={handleMomentumPromptDecline}
        />
      )}
    </AppShell>
  )
}

export default App
