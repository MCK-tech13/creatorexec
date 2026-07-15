import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import { AppShell } from './components/layout/AppShell'
import { OnboardingQuiz } from './components/onboarding/OnboardingQuiz'
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
import { RetainerDeals } from './components/pipeline/RetainerDeals'
import { IncomeTracker } from './components/income/IncomeTracker'
import { ProductScout } from './components/productScout/ProductScout'
import { DashboardHome } from './components/dashboard/DashboardHome'
import { useProductScout } from './hooks/useProductScout'
import { useFilmingProgress } from './hooks/useFilmingProgress'
import {
  buildIncomeHomePreview,
  buildProductScoutHomePreview,
  buildRetainerHomePreview,
  buildSprintHomePreview,
} from './lib/dashboard/homePreview'
import { loadIncomeTracker } from './lib/income/incomeStorage'
import { SprintEmptyState } from './components/sprint/SprintEmptyState'
import { SprintReviewModal } from './components/sprint/SprintReviewModal'
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
import {
  hydrateProductsTrialProgress,
  persistProductVideosFilmed,
} from './lib/schedule/trialProgress'
import {
  clearTrialProgress,
  trialStorageKey,
} from './lib/schedule/trialProgressStorage'
import { captureSprintEndReview } from './lib/sprint/finalizeSprint'
import {
  clearCurrentSprintState,
  loadCurrentSprintState,
  saveCurrentSprintState,
} from './lib/sprint/currentSprintStorage'
import { previewLegacyFilmingMerge } from './lib/sprint/filmingProgressMigration'
import {
  clearSprintSnapshots,
  saveSprintStartSnapshot,
} from './lib/sprint/sprintSnapshotStorage'
import { getActiveUserId } from './lib/supabase/dataStore'
import { snapshotFromProducts } from './types/sprintReview'
import {
  hasPersistedSprintContent,
  type CurrentSprintState,
} from './types/currentSprint'
import { useBrandDeals } from './hooks/useBrandDeals'
import {
  buildRetainerScheduleEntries,
  buildRetainerVideos,
  dealsToPipelineDeadlines,
  mergeDeadlineProducts,
} from './lib/pipeline/pipelineScheduleIntegration'
import {
  clearOnboardingProfile,
  loadOnboardingProfile,
  saveOnboardingProfile,
  updateUserMode,
} from './lib/onboarding/storage'
import { stageFromMonthlyCommission, resolveHomeView } from './lib/onboarding/routing'
import {
  clearSprintEntrySeen,
  hasSeenSprintEntry,
  markSprintEntrySeen,
} from './lib/onboarding/sprintEntryStorage'
import type {
  AppStage,
  DaySchedule,
  DeadlineProduct,
  ManualProductFormData,
  MergedProduct,
  MainSection,
  SampleProduct,
  ScheduleMode,
  SprintConfig,
  Tier,
} from './types'
import { TIER_REVIEW_VIDEO_COUNT } from './types'
import type { OnboardingProfile, UserMode } from './types/onboarding'
import type { BrandDeal } from './types/pipeline'
import type { SprintReview } from './types/sprintReview'
import { isActiveRetainer } from './lib/pipeline/retainerUtils'

function initialSprintConfig(): SprintConfig {
  const stored = loadOnboardingProfile()?.videosPerDay
  return {
    videosPerDay: stored && stored >= 1 ? stored : 5,
    sprintDays: 7,
  }
}

function initialAppStage(): AppStage {
  return resolveHomeView().stage
}

function initialUploadLandingMode(): 'routed' | 'empty' {
  return resolveHomeView().uploadLandingMode
}

function readRestoredSprint(): CurrentSprintState | null {
  const saved = loadCurrentSprintState()
  if (!saved || !hasPersistedSprintContent(saved)) return null
  try {
    return {
      ...saved,
      filmingProgress: previewLegacyFilmingMerge(getActiveUserId(), saved.filmingProgress),
    }
  } catch {
    return saved
  }
}

function buildScheduleForMode(
  mode: ScheduleMode,
  products: MergedProduct[],
  config: SprintConfig,
  deadlines: DeadlineProduct[],
  excluded: Set<string>,
  brandDeals: BrandDeal[],
  dailyPostingVolume: number,
): DaySchedule[] {
  const pipelineDeadlines = dealsToPipelineDeadlines(brandDeals)
  const mergedDeadlines = mergeDeadlineProducts(deadlines, pipelineDeadlines)
  const retainerEntries = buildRetainerScheduleEntries(
    brandDeals,
    config,
    dailyPostingVolume,
  )
  const retainerVideos = buildRetainerVideos(retainerEntries, config.sprintDays)

  if (mode === 'sample') {
    return buildSampleModeSchedule(
      products,
      config,
      mergedDeadlines,
      retainerVideos,
    )
  }
  if (mode === 'momentum') {
    return buildMomentumModeSchedule(
      products,
      config,
      mergedDeadlines,
      excluded,
      retainerVideos,
    )
  }
  return buildFilmingSchedule(
    products,
    config,
    mergedDeadlines,
    excluded,
    retainerVideos,
  )
}

export default function CreatorExecApp() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const restoredRef = useRef<CurrentSprintState | null>(readRestoredSprint())
  const restored = restoredRef.current
  const clearingRef = useRef(false)

  const [onboardingComplete, setOnboardingComplete] = useState(
    () => loadOnboardingProfile() !== null,
  )
  const [userMode, setUserMode] = useState<UserMode>(
    () => loadOnboardingProfile()?.mode ?? 'beginner',
  )
  const [stage, setStage] = useState<AppStage>(() => restored?.stage ?? initialAppStage())
  const [uploadLandingMode, setUploadLandingMode] = useState<'routed' | 'empty'>(
    initialUploadLandingMode,
  )
  const [products, setProducts] = useState<MergedProduct[]>(() => restored?.products ?? [])
  const [deadlineProducts, setDeadlineProducts] = useState<DeadlineProduct[]>(
    () => restored?.deadlineProducts ?? [],
  )
  const [excludedFromSchedule, setExcludedFromSchedule] = useState<Set<string>>(
    () => new Set(restored?.excludedProductKeys ?? []),
  )
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  const [activeTier, setActiveTier] = useState<Tier | 'All'>('All')
  const [sprintConfig, setSprintConfig] = useState<SprintConfig>(
    () => restored?.sprintConfig ?? initialSprintConfig(),
  )
  const [schedule, setSchedule] = useState<DaySchedule[]>(() => restored?.schedule ?? [])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(() => restored?.fileName ?? null)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(
    () => restored?.scheduleMode ?? 'full',
  )
  const [sampleProducts, setSampleProducts] = useState<SampleProduct[]>(
    () => restored?.sampleProducts ?? [],
  )
  const [pendingProducts, setPendingProducts] = useState<MergedProduct[] | null>(null)
  const [showMomentumPrompt, setShowMomentumPrompt] = useState(false)
  const [mainSection, setMainSection] = useState<MainSection>(() =>
    restored?.stage === 'schedule' ? 'sprint' : 'home',
  )
  const [showUploadPanel, setShowUploadPanel] = useState(false)
  const [openNewRetainerDeal, setOpenNewRetainerDeal] = useState(false)
  const [showProductEntry, setShowProductEntry] = useState(false)
  const [sprintReview, setSprintReview] = useState<SprintReview | null>(null)
  const [pendingSprintReset, setPendingSprintReset] = useState<'upload' | 'start-over' | null>(
    null,
  )
  /** Gate autosave until restore seed is in React state (avoids empty overwrite). */
  const [persistEnabled, setPersistEnabled] = useState(false)

  const {
    progress: filmingProgress,
    getCount: getFilmedCount,
    increment: incrementFilmed,
    decrement: decrementFilmed,
    reset: resetFilmingProgress,
    setProgress: setFilmingProgress,
  } = useFilmingProgress(restored?.filmingProgress ?? {})

  useEffect(() => {
    // Surface legacy localStorage checkmarks in UI before the first cloud save consumes them.
    try {
      const merged = previewLegacyFilmingMerge(getActiveUserId(), filmingProgress)
      const changed = Object.keys(merged).some(
        (key) => merged[key] !== (filmingProgress[key] ?? 0),
      )
      if (changed) setFilmingProgress(merged)
    } catch {
      // data store not ready outside UserDataProvider — ignore
    }
    setPersistEnabled(true)
  }, [])

  useEffect(() => {
    if (!persistEnabled || clearingRef.current) return

    const next: CurrentSprintState = {
      stage,
      scheduleMode,
      fileName,
      sprintConfig,
      products,
      deadlineProducts,
      excludedProductKeys: [...excludedFromSchedule],
      sampleProducts,
      schedule,
      filmingProgress,
    }

    // Never delete via autosave — empty just means "nothing to upsert yet".
    if (!hasPersistedSprintContent(next)) return

    saveCurrentSprintState(next)
  }, [
    persistEnabled,
    stage,
    scheduleMode,
    fileName,
    sprintConfig,
    products,
    deadlineProducts,
    excludedFromSchedule,
    sampleProducts,
    schedule,
    filmingProgress,
  ])

  const saveCurrentSprintStart = useCallback(
    (
      productList: MergedProduct[],
      config: SprintConfig,
      mode: ScheduleMode,
      reportName: string | null,
    ) => {
      saveSprintStartSnapshot(
        snapshotFromProducts(productList, config, mode, reportName, trialStorageKey),
      )
    },
    [],
  )

  const {
    deals: brandDeals,
    addDeal,
    updateDeal,
    moveDeal,
    removeDeal,
    toggleChecklistItem,
  } = useBrandDeals()

  const {
    entries: productScoutEntries,
    addEntry: addProductScoutEntry,
    updateEntry: updateProductScoutEntry,
    removeEntry: removeProductScoutEntry,
  } = useProductScout()

  const dailyPostingVolume = sprintConfig.videosPerDay

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
      deals = brandDeals,
    ) => {
      const hydrated = hydrateProductsTrialProgress(productList)
      if (
        hydrated.some(
          (product, index) => product.videosFilmed !== productList[index]?.videosFilmed,
        )
      ) {
        setProducts(hydrated)
      }
      setSchedule(
        buildScheduleForMode(
          mode,
          hydrated,
          config,
          deadlines,
          excluded,
          deals,
          config.videosPerDay,
        ),
      )
    },
    [brandDeals],
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
    (tiered: MergedProduct[], mode: ScheduleMode, reportName: string | null = fileName) => {
      const hydrated = hydrateProductsTrialProgress(tiered)
      setProducts(hydrated)
      setScheduleMode(mode)
      setSampleProducts([])
      setDeadlineProducts([])
      setExcludedFromSchedule(new Set())
      setActiveTier('All')
      setIsProcessing(false)
      setStage('dashboard')
      saveCurrentSprintStart(hydrated, sprintConfig, mode, reportName)
    },
    [fileName, saveCurrentSprintStart, sprintConfig],
  )

  const handleOnboardingComplete = useCallback((profile: OnboardingProfile) => {
    saveOnboardingProfile(profile)
    setUserMode(profile.mode)
    setSprintConfig((prev) => ({ ...prev, videosPerDay: profile.videosPerDay }))
    setOnboardingComplete(true)
    markSprintEntrySeen()
    setUploadLandingMode('routed')
    setStage(stageFromMonthlyCommission(profile.answers.monthlyCommission))
  }, [])

  const handleSwitchToAdvanced = useCallback(() => {
    setUserMode('advanced')
    updateUserMode('advanced')
  }, [])

  const handleResetOnboarding = useCallback(() => {
    setPersistEnabled(false)
    clearingRef.current = true
    clearOnboardingProfile()
    clearSprintEntrySeen()
    setOnboardingComplete(false)
    setUserMode('beginner')
    setMainSection('home')
    setStage('upload')
    setProducts([])
    setDeadlineProducts([])
    setExcludedFromSchedule(new Set())
    setSchedule([])
    setError(null)
    setFileName(null)
    setSprintConfig({ videosPerDay: 5, sprintDays: 7 })
    setActiveTier('All')
    resetFilmingProgress()
    clearCurrentSprintState()
    clearTrialProgress()
    clearSprintSnapshots()
    setScheduleMode('full')
    setSampleProducts([])
    setPendingProducts(null)
    setShowMomentumPrompt(false)
    setUploadLandingMode('routed')
    setShowProductEntry(false)
    clearingRef.current = false
    setPersistEnabled(true)
  }, [resetFilmingProgress])

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
          finishUpload(tierProductsMomentum(result.products), 'momentum', file.name)
          return
        }

        if (shouldSuggestMomentumMode(fullTiered)) {
          setPendingProducts(fullTiered)
          setShowMomentumPrompt(true)
          setIsProcessing(false)
          return
        }

        finishUpload(fullTiered, 'full', file.name)
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
        const target = prev.find((p) => p.id === productId)
        if (target) {
          persistProductVideosFilmed(target, videosFilmed)
        }
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

  const handleMarkTrialPreviouslyCompleted = useCallback(
    (productId: string) => {
      handleVideosFilmedChange(productId, TIER_REVIEW_VIDEO_COUNT)
    },
    [handleVideosFilmedChange],
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
        if (data.videosFilmed > 0) {
          persistProductVideosFilmed(newProduct, data.videosFilmed)
        }
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

  const resetSprintState = useCallback(() => {
    setPersistEnabled(false)
    clearingRef.current = true
    setShowProductEntry(false)
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
    resetFilmingProgress()
    clearCurrentSprintState()
    clearingRef.current = false
    setPersistEnabled(true)
  }, [resetFilmingProgress])

  const beginNextSprint = useCallback(
    (resetKind: 'upload' | 'start-over') => {
      if (products.length === 0) {
        resetSprintState()
        setUploadLandingMode(resetKind === 'start-over' ? 'empty' : 'routed')
        setStage('upload')
        return
      }

      const review = captureSprintEndReview(
        products,
        sprintConfig,
        scheduleMode,
        fileName,
      )
      if (!review) {
        resetSprintState()
        setUploadLandingMode(resetKind === 'start-over' ? 'empty' : 'routed')
        setStage('upload')
        return
      }

      setSprintReview(review)
      setPendingSprintReset(resetKind)
    },
    [products, sprintConfig, scheduleMode, fileName, resetSprintState],
  )

  const handleSprintReviewContinue = useCallback(() => {
    setSprintReview(null)
    const resetKind = pendingSprintReset ?? 'upload'
    setPendingSprintReset(null)
    resetSprintState()
    setUploadLandingMode(resetKind === 'start-over' ? 'empty' : 'routed')
    setStage('upload')
  }, [pendingSprintReset, resetSprintState])

  const handleGenerateSchedule = () => {
    saveCurrentSprintStart(products, sprintConfig, scheduleMode, fileName)
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
    setUploadLandingMode('routed')
    setStage('sample')
    setShowProductEntry(false)
  }, [])

  const handleEnterMomentumMode = useCallback(() => {
    setError(null)
    setScheduleMode('full')
    setProducts([])
    setSampleProducts([])
    setSchedule([])
    setFileName(null)
    setUploadLandingMode('routed')
    setStage('momentum')
    setShowProductEntry(false)
  }, [])

  const handleEnterUpload = useCallback(() => {
    setError(null)
    setUploadLandingMode('routed')
    setStage('upload')
  }, [])

  const handleAddProductsFromRetainer = useCallback(() => {
    setShowProductEntry(true)
    setUploadLandingMode('routed')
    setStage('upload')
    setShowUploadPanel(false)
    setError(null)
  }, [])

  const handleSampleBuildSchedule = useCallback((items: SampleProduct[]) => {
    setSampleProducts(items)
    const merged = hydrateProductsTrialProgress(sampleProductsToMerged(items))
    setProducts(merged)
    setScheduleMode('sample')
    setDeadlineProducts([])
    setExcludedFromSchedule(new Set())
    setStage('config')
    saveCurrentSprintStart(merged, sprintConfig, 'sample', null)
  }, [saveCurrentSprintStart, sprintConfig])

  const handleUploadReport = useCallback(() => {
    beginNextSprint('upload')
  }, [beginNextSprint])

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
    beginNextSprint('start-over')
  }

  const topEarnerLine = isMomentumMode ? formatTopEarnerLine(products) : null

  const hasProductData = products.length > 0 || sampleProducts.length > 0
  const hasActiveRetainers = brandDeals.some(isActiveRetainer)
  const showSprintEmptyState =
    mainSection === 'sprint' &&
    uploadLandingMode === 'empty' &&
    !hasProductData &&
    !hasActiveRetainers &&
    !isProcessing &&
    stage === 'upload' &&
    !showUploadPanel

  const showRetainerOnlySchedule =
    mainSection === 'sprint' &&
    hasActiveRetainers &&
    !hasProductData &&
    stage === 'upload' &&
    !showUploadPanel &&
    !showProductEntry

  const useWideContent =
    mainSection === 'home' ||
    mainSection === 'retainers' ||
    mainSection === 'income' ||
    mainSection === 'product-scout' ||
    (mainSection === 'sprint' &&
      onboardingComplete &&
      (stage === 'dashboard' ||
        stage === 'schedule' ||
        showRetainerOnlySchedule))

  const handleSectionChange = useCallback((section: MainSection) => {
    setMainSection(section)
  }, [])

  const handleGoHome = useCallback(() => {
    setMainSection('home')
  }, [])

  const handleSignOut = useCallback(async () => {
    const result = await signOut()
    if (!result.error) {
      navigate('/', { replace: true })
    }
  }, [navigate, signOut])

  const handleAddRetainerFromEmpty = useCallback(() => {
    setOpenNewRetainerDeal(true)
    setMainSection('retainers')
  }, [])

  const dashboardPreviews = useMemo(
    () => ({
      sprint: buildSprintHomePreview({
        sprintOnboardingComplete: onboardingComplete,
        hasProductData,
        hasActiveRetainers,
        schedule,
        productCount: products.length,
        videosPerDay: sprintConfig.videosPerDay,
      }),
      retainers: buildRetainerHomePreview(brandDeals),
      income: buildIncomeHomePreview(loadIncomeTracker()),
      productScout: buildProductScoutHomePreview(productScoutEntries),
    }),
    [
      onboardingComplete,
      hasProductData,
      hasActiveRetainers,
      schedule,
      products.length,
      sprintConfig.videosPerDay,
      brandDeals,
      productScoutEntries,
      mainSection,
    ],
  )

  useEffect(() => {
    if (!onboardingComplete || hasSeenSprintEntry()) return

    const markSeen = () => markSprintEntrySeen()
    window.addEventListener('beforeunload', markSeen)
    return () => {
      window.removeEventListener('beforeunload', markSeen)
      markSeen()
    }
  }, [onboardingComplete])

  const skipRestoredScheduleRebuildRef = useRef(
    Boolean(restored && restored.schedule.length > 0),
  )

  useEffect(() => {
    if (skipRestoredScheduleRebuildRef.current) {
      // Keep the materialized schedule from Supabase; do not rebuild on first mount.
      skipRestoredScheduleRebuildRef.current = false
      return
    }

    const retainerOnlyOnUpload =
      hasActiveRetainers && !hasProductData && stage === 'upload'
    if (
      mainSection === 'sprint' &&
      (stage === 'schedule' || retainerOnlyOnUpload)
    ) {
      rebuildSchedule(
        products,
        deadlineProducts,
        sprintConfig,
        excludedFromSchedule,
        scheduleMode,
      )
    }
  }, [brandDeals])

  return (
    <AppShell
      stage={stage}
      mainSection={mainSection}
      onSectionChange={handleSectionChange}
      onGoHome={handleGoHome}
      onSignOut={handleSignOut}
      userEmail={user?.email ?? null}
      onResetOnboarding={handleResetOnboarding}
      sprintSetupComplete={onboardingComplete}
      contentWidth={useWideContent ? 'wide' : 'narrow'}
      showSprintStepper={mainSection === 'sprint' && onboardingComplete}
    >
      {mainSection === 'home' ? (
        <DashboardHome
          sprint={dashboardPreviews.sprint}
          retainers={dashboardPreviews.retainers}
          income={dashboardPreviews.income}
          productScout={dashboardPreviews.productScout}
          onNavigate={handleSectionChange}
        />
      ) : mainSection === 'retainers' ? (
        <RetainerDeals
          deals={brandDeals}
          dailyPostingVolume={dailyPostingVolume}
          onAddDeal={addDeal}
          onUpdateDeal={updateDeal}
          onMoveDeal={moveDeal}
          onRemoveDeal={removeDeal}
          onToggleChecklist={toggleChecklistItem}
          openNewDealRequest={openNewRetainerDeal}
          onNewDealOpenHandled={() => setOpenNewRetainerDeal(false)}
        />
      ) : mainSection === 'income' ? (
        <IncomeTracker />
      ) : mainSection === 'product-scout' ? (
        <ProductScout
          entries={productScoutEntries}
          onAddEntry={(productName, metrics) =>
            addProductScoutEntry({ productName, metrics })
          }
          onUpdateEntry={updateProductScoutEntry}
          onRemoveEntry={removeProductScoutEntry}
        />
      ) : mainSection === 'sprint' && !onboardingComplete ? (
        <OnboardingQuiz onComplete={handleOnboardingComplete} embedded />
      ) : (
        <>
      {showSprintEmptyState ? (
        <SprintEmptyState
          onAddSamples={handleEnterSampleMode}
          onUploadReport={() => setShowUploadPanel(true)}
          onAddRetainerDeal={handleAddRetainerFromEmpty}
        />
      ) : stage === 'upload' && !showRetainerOnlySchedule ? (
        <div className="fade-in">
          {showProductEntry && hasActiveRetainers && (
            <button
              type="button"
              onClick={() => setShowProductEntry(false)}
              className="link-elegant mb-6 font-body text-sm text-stone"
            >
              ← Back to retainer schedule
            </button>
          )}
          {showUploadPanel && (
            <button
              type="button"
              onClick={() => setShowUploadPanel(false)}
              className="link-elegant mb-6 font-body text-sm text-stone"
            >
              ← Back
            </button>
          )}
          <CsvUploadZone
            onFileLoaded={(file) => handleFileLoaded(file)}
            onEnterSampleMode={handleEnterSampleMode}
            onEnterMomentumMode={handleEnterMomentumMode}
            isProcessing={isProcessing}
          />
          {error && (
            <div className="mt-6 border border-border-warm px-6 py-4 font-body text-sm text-stone">
              {error}
            </div>
          )}
        </div>
      ) : null}

      {stage === 'sample' && (
        <SampleModeScreen
          initialProducts={sampleProducts}
          onBuildSchedule={handleSampleBuildSchedule}
          onEnterUpload={handleEnterUpload}
          onEnterMomentum={handleEnterMomentumMode}
        />
      )}

      {stage === 'momentum' && (
        <div className="fade-in">
          <MomentumModeScreen
            onFileLoaded={(file) => handleFileLoaded(file, { fromMomentumEntry: true })}
            onEnterUpload={handleEnterUpload}
            onEnterSampleMode={handleEnterSampleMode}
            isProcessing={isProcessing}
          />
          {error && (
            <div className="mt-6 border border-border-warm px-6 py-4 font-body text-sm text-stone">
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
            <div className="border border-terracotta/40 bg-terracotta-tint px-6 py-5">
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
          <div className="mt-8 sm:mt-12">
            <TierTabs
              products={products}
              activeTier={activeTier}
              onTierChange={setActiveTier}
            />
            {isBeginnerMode && !isMomentumMode && (
              <div className="mt-3 flex justify-end sm:mt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvancedControls((v) => !v)}
                  className="link-elegant font-body text-sm text-ink"
                >
                  {showAdvancedControls ? 'Hide advanced controls' : 'Show advanced controls'}
                </button>
              </div>
            )}
          </div>
          <ProductTable
            products={products}
            activeTier={activeTier}
            beginnerMode={isBeginnerMode && !isMomentumMode}
            advancedControlsOpen={showAdvancedControls}
            onVideosFilmedChange={handleVideosFilmedChange}
            onInRotationChange={handleInRotationChange}
            onMarkTrialPreviouslyCompleted={handleMarkTrialPreviouslyCompleted}
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

      {(stage === 'schedule' || showRetainerOnlySchedule) && (
        <FilmingSchedule
          schedule={schedule}
          products={products}
          beginnerMode={isBeginnerMode && !isMomentumMode}
          sampleMode={isSampleMode}
          momentumMode={isMomentumMode}
          getFilmedCount={getFilmedCount}
          onFilmedIncrement={incrementFilmed}
          onFilmedDecrement={decrementFilmed}
          onAddDeadline={handleAddDeadline}
          onRemoveFromSchedule={handleRemoveFromSchedule}
          onBack={
            showRetainerOnlySchedule ? () => {} : () => setStage('config')
          }
          onStartOver={
            showRetainerOnlySchedule ? handleAddProductsFromRetainer : handleStartOver
          }
          onUploadReport={isSampleMode ? handleUploadReport : undefined}
          retainerOnly={showRetainerOnlySchedule}
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

      {sprintReview && (
        <SprintReviewModal review={sprintReview} onContinue={handleSprintReviewContinue} />
      )}
        </>
      )}
    </AppShell>
  )
}
