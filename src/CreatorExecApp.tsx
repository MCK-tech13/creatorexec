import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import { AppShell } from './components/layout/AppShell'
import { OnboardingQuiz } from './components/onboarding/OnboardingQuiz'
import { CsvUploadZone } from './components/upload/CsvUploadZone'
import { SampleModeScreen } from './components/sample/SampleModeScreen'
import { StatsCards } from './components/dashboard/StatsCards'
import { TierTabs } from './components/dashboard/TierTabs'
import { ProductTable } from './components/dashboard/ProductTable'
import { UploadReminderBanner } from './components/dashboard/UploadReminderBanner'
import { AddProductModal } from './components/dashboard/AddProductModal'
import { SprintConfigForm } from './components/config/SprintConfigForm'
import { FilmingSchedule } from './components/schedule/FilmingSchedule'
import { RetainerDeals } from './components/pipeline/RetainerDeals'
import { CaptionMatchConfirmModal } from './components/pipeline/CaptionMatchConfirmModal'
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
import { FirstSprintCelebration } from './components/celebrations/FirstSprintCelebration'
import {
  AlreadyTestedToast,
  type AlreadyTestedNotice,
} from './components/dashboard/AlreadyTestedToast'
import {
  hasSeenFirstSprintCelebration,
  markFirstSprintCelebrationSeen,
  resetFirstSprintCelebrationSeen,
} from './lib/celebrations/firstSprintStorage'
import { parseCommissionFile, isParseError } from './lib/csv/parser'
import { computeScore } from './lib/analysis/tierEngine'
import {
  formatTopEarnerLine,
  retierProductsForMode,
  shouldSuggestMomentumMode,
  tierProductsMomentum,
} from './lib/analysis/momentumMode'
import { buildMomentumModeSchedule } from './lib/schedule/momentumModeSchedule'
import { buildSopModeSchedule } from './lib/schedule/sopSchedule'
import {
  hydrateProductsTrialProgress,
  persistProductVideosFilmed,
} from './lib/schedule/trialProgress'
import {
  clearTrialProgress,
  trialStorageKey,
} from './lib/schedule/trialProgressStorage'
import { persistScheduleFilmedDelta } from './lib/schedule/scheduleFilmingTrialSync'
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
import {
  clearProductCatalog,
  upsertCatalogFromMergedProducts,
  upsertCatalogFromSampleProducts,
} from './lib/catalog/productCatalogStorage'
import {
  activeCatalogProducts,
  buildSprintProductsFromCatalog,
  enrichProductsWithCatalogFavorites,
  normalizeScheduleMode,
} from './lib/catalog/catalogSprint'
import { getActiveUserId, getUserDataSnapshot } from './lib/supabase/dataStore'
import { buildProductFlags } from './lib/sprint/productFlags'
import {
  daysBetween,
  shouldShowUploadReminderBanner,
} from './lib/reminders/uploadReminder'
import {
  dismissUploadReminderBanner,
  markCsvUploadNow,
} from './lib/reminders/engagementStorage'
import {
  appPathForSection,
  parseAppSectionPath,
} from './lib/navigation/appSections'
import { snapshotFromProducts } from './types/sprintReview'
import {
  hasPersistedSprintContent,
  type CurrentSprintState,
} from './types/currentSprint'
import { useBrandDeals } from './hooks/useBrandDeals'
import { useCaptionMatchSuggestions } from './hooks/useCaptionMatchSuggestions'
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
      // Legacy full/sample → sop; momentum only when silent low-data fallback applies.
      scheduleMode: normalizeScheduleMode(saved.scheduleMode),
      // Momentum is no longer a user-reachable stage.
      stage: saved.stage === 'momentum' ? 'upload' : saved.stage,
      filmingProgress: previewLegacyFilmingMerge(getActiveUserId(), saved.filmingProgress),
    }
  } catch {
    return {
      ...saved,
      scheduleMode: normalizeScheduleMode(saved.scheduleMode),
      stage: saved.stage === 'momentum' ? 'upload' : saved.stage,
    }
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

  // Stage 3: `sample` schedule mode no longer exists.
  // User-reachable paths: Momentum (silent low-data) or SOP. Full scheduler stays in-repo unused.
  if (mode === 'momentum') {
    return buildMomentumModeSchedule(
      products,
      config,
      mergedDeadlines,
      excluded,
      retainerVideos,
    )
  }
  return buildSopModeSchedule(
    products,
    config,
    mergedDeadlines,
    excluded,
    retainerVideos,
  )
}

export default function CreatorExecApp() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const restoredRef = useRef<CurrentSprintState | null>(readRestoredSprint())
  const restored = restoredRef.current
  const clearingRef = useRef(false)

  const resolveSectionForBareApp = useCallback((): MainSection => {
    return restoredRef.current?.stage === 'schedule' ? 'sprint' : 'home'
  }, [])

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
  const [products, setProducts] = useState<MergedProduct[]>(() =>
    enrichProductsWithCatalogFavorites(restored?.products ?? []),
  )
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
    () => normalizeScheduleMode(restored?.scheduleMode),
  )
  const [sampleProducts, setSampleProducts] = useState<SampleProduct[]>(
    () => restored?.sampleProducts ?? [],
  )
  const [mainSection, setMainSection] = useState<MainSection>(() => {
    const fromUrl = parseAppSectionPath(window.location.pathname)
    if (fromUrl && fromUrl !== 'invalid') return fromUrl
    // Bare `/app` or unknown — sprint-restore fallback only when URL has no section.
    return restored?.stage === 'schedule' ? 'sprint' : 'home'
  })
  const [showUploadPanel, setShowUploadPanel] = useState(false)
  const [openNewRetainerDeal, setOpenNewRetainerDeal] = useState(false)
  const [showProductEntry, setShowProductEntry] = useState(false)
  const [sprintReview, setSprintReview] = useState<SprintReview | null>(null)
  const [pendingSprintReset, setPendingSprintReset] = useState<'upload' | 'start-over' | null>(
    null,
  )
  const [alreadyTestedNotice, setAlreadyTestedNotice] = useState<AlreadyTestedNotice | null>(
    null,
  )
  const [firstSprintCelebration, setFirstSprintCelebration] = useState<{
    videosFilmed: number
    productsTested: number
  } | null>(null)
  /** Re-read engagement after mark/dismiss without a full reload. */
  const [engagementTick, setEngagementTick] = useState(0)
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
    seedCaptionMatchDemoDeals,
    updateDeal,
    moveDeal,
    removeDeal,
    toggleChecklistItem,
    completeNextIncompleteChecklistItem,
  } = useBrandDeals()

  const {
    ready: captionMatchReady,
    activeSuggestion: captionMatchSuggestion,
    remainingAfterCurrent: captionMatchRemainingAfter,
    declineSuggestion: declineCaptionMatch,
    markSuggestionConfirmed,
    resetDemoHistory: resetCaptionMatchDemoHistory,
  } = useCaptionMatchSuggestions(brandDeals)

  const handleLoadCaptionMatchDemo = useCallback(() => {
    // Always re-seed fresh incomplete retainers + clear dismiss/confirm history.
    // Prior flow only added missing brands, so a second click after confirming
    // videos left full checklists and the modal never returned.
    seedCaptionMatchDemoDeals()
    resetCaptionMatchDemoHistory()
    setMainSection('retainers')
    navigate(appPathForSection('retainers'))
  }, [seedCaptionMatchDemoDeals, resetCaptionMatchDemoHistory, navigate])

  const handleCaptionMatchConfirm = useCallback(() => {
    if (!captionMatchSuggestion) return
    // Generic next-incomplete checklist item (demo simplification — not per-deliverable).
    completeNextIncompleteChecklistItem(captionMatchSuggestion.dealId)
    markSuggestionConfirmed(captionMatchSuggestion)
  }, [captionMatchSuggestion, completeNextIncompleteChecklistItem, markSuggestionConfirmed])

  const handleCaptionMatchDecline = useCallback(() => {
    if (!captionMatchSuggestion) return
    declineCaptionMatch(captionMatchSuggestion)
  }, [captionMatchSuggestion, declineCaptionMatch])

  const showCaptionMatchModal =
    captionMatchReady &&
    !firstSprintCelebration &&
    !sprintReview &&
    Boolean(captionMatchSuggestion)

  const {
    entries: productScoutEntries,
    addEntry: addProductScoutEntry,
    updateEntry: updateProductScoutEntry,
    removeEntry: removeProductScoutEntry,
    persistNow: persistProductScoutNow,
    persistError: productScoutPersistError,
    clearPersistError: clearProductScoutPersistError,
  } = useProductScout()

  const dailyPostingVolume = sprintConfig.videosPerDay

  const isBeginnerMode = userMode === 'beginner'
  // Momentum may run silently for low-data uploads; never shown as a named mode.
  const usesSilentMomentum = scheduleMode === 'momentum'

  const sopRetierOptions = useCallback(
    (config: SprintConfig = sprintConfig) => ({
      dailyVolume: config.videosPerDay,
      sprintDays: config.sprintDays,
    }),
    [sprintConfig],
  )

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
      const videosChanged = hydrated.some(
        (product, index) => product.videosFilmed !== productList[index]?.videosFilmed,
      )
      // If persisted "already tested" progress restored videosFilmed, re-tier so
      // products aren't held in Test for a trial they opted out of.
      const next =
        videosChanged
          ? retierProductsForMode(hydrated, mode, sopRetierOptions(config))
          : hydrated
      if (
        next.some(
          (product, index) =>
            product.videosFilmed !== productList[index]?.videosFilmed ||
            product.tier !== productList[index]?.tier ||
            product.sopTier !== productList[index]?.sopTier,
        )
      ) {
        setProducts(next)
      }
      setSchedule(
        buildScheduleForMode(
          mode,
          next,
          config,
          deadlines,
          excluded,
          deals,
          config.videosPerDay,
        ),
      )
    },
    [brandDeals, sopRetierOptions],
  )

  const retierPreservingManual = useCallback(
    (
      updated: MergedProduct[],
      mode: ScheduleMode,
      config: SprintConfig = sprintConfig,
    ): MergedProduct[] => {
      return retierProductsForMode(updated, mode, sopRetierOptions(config))
    },
    [sprintConfig, sopRetierOptions],
  )

  const dismissAlreadyTestedNotice = useCallback(() => {
    setAlreadyTestedNotice(null)
  }, [])

  const handleMarkTrialPreviouslyCompleted = useCallback(
    (productId: string) => {
      setProducts((prev) => {
        const target = prev.find((p) => p.id === productId)
        if (!target) return prev

        // Explicit opt-in: skip the guaranteed 6-video trial for products the
        // creator already tested before CreatorExec. Re-tiers from CSV sales data.
        persistProductVideosFilmed(target, TIER_REVIEW_VIDEO_COUNT)
        const updated = prev.map((p) =>
          p.id === productId ? { ...p, videosFilmed: TIER_REVIEW_VIDEO_COUNT } : p,
        )
        const tiered = retierPreservingManual(updated, scheduleMode)
        const nextProduct = tiered.find((p) => p.id === productId)
        if (nextProduct) {
          setAlreadyTestedNotice({
            productName: nextProduct.productName,
            previousTier: target.tier,
            nextTier: nextProduct.tier,
          })
          // Follow the product if it left the active tab (e.g. Test → Cut).
          if (nextProduct.tier !== 'Test' && activeTier === 'Test') {
            setActiveTier(nextProduct.tier)
          }
        }
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
      activeTier,
    ],
  )

  const finishUpload = useCallback(
    (tiered: MergedProduct[], mode: ScheduleMode, reportName: string | null = fileName) => {
      const effectiveMode = normalizeScheduleMode(mode)
      // Stage 3: upsert CSV metrics into durable catalog, then rebuild sprint FROM catalog
      // so sample/favorite-only rows stay in rotation alongside report products.
      upsertCatalogFromMergedProducts(tiered, 'csv')
      const fromCatalog = buildSprintProductsFromCatalog(undefined, {
        mode: effectiveMode,
        ...sopRetierOptions(sprintConfig),
      })
      setProducts(fromCatalog)
      setScheduleMode(effectiveMode)
      setSampleProducts([])
      setDeadlineProducts([])
      setExcludedFromSchedule(new Set())
      setActiveTier('All')
      setIsProcessing(false)
      setStage('dashboard')
      saveCurrentSprintStart(fromCatalog, sprintConfig, effectiveMode, reportName)
    },
    [
      fileName,
      saveCurrentSprintStart,
      sprintConfig,
      sopRetierOptions,
    ],
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
    // Quiz only renders on the Sprint section — send them there to retake it.
    setMainSection('sprint')
    navigate(appPathForSection('sprint'))
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
    clearProductCatalog()
    clearSprintSnapshots()
    resetFirstSprintCelebrationSeen(getActiveUserId())
    setScheduleMode('sop')
    setSampleProducts([])
    setUploadLandingMode('routed')
    setShowProductEntry(false)
    clearingRef.current = false
    setPersistEnabled(true)
  }, [navigate, resetFilmingProgress])

  const handleFileLoaded = useCallback(
    async (file: File) => {
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

        markCsvUploadNow()
        setEngagementTick((tick) => tick + 1)

        // Silent Momentum fallback when low sales density; otherwise SOP.
        if (shouldSuggestMomentumMode(result.products as MergedProduct[])) {
          finishUpload(tierProductsMomentum(result.products), 'momentum', file.name)
          return
        }

        finishUpload(
          result.products.map((p) => ({
            ...p,
            score: 0,
            tier: 'Test' as const,
            rankInTier: 0,
          })),
          'sop',
          file.name,
        )
      } catch {
        setError('Failed to read the file. Please try again.')
        setIsProcessing(false)
      }
    },
    [finishUpload],
  )

  const handleSprintConfigChange = useCallback(
    (config: SprintConfig) => {
      setSprintConfig(config)
      if (scheduleMode === 'momentum') return
      // Volume changes Top/Mid counts and Band thresholds — re-rank live (SOP).
      setProducts((prev) => retierPreservingManual(prev, 'sop', config))
    },
    [scheduleMode, retierPreservingManual],
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

  /**
   * Schedule +/- checkmarks: advance durable trial_progress immediately so
   * cumulative filmed counts survive Start Over (filmingProgress alone does not).
   * Does not rebuild the live schedule mid-sprint.
   */
  const handleScheduleFilmedIncrement = useCallback(
    (storageKey: string, max: number, productKey: string) => {
      incrementFilmed(storageKey, max)
      setProducts((prev) => {
        const next = persistScheduleFilmedDelta(prev, productKey, 1)
        if (next === prev) return prev
        const modeForTier = scheduleMode
        const tiered = retierPreservingManual(next, modeForTier)
        return tiered
      })
    },
    [incrementFilmed, scheduleMode, retierPreservingManual],
  )

  const handleScheduleFilmedDecrement = useCallback(
    (storageKey: string, productKey: string) => {
      decrementFilmed(storageKey)
      setProducts((prev) => {
        const next = persistScheduleFilmedDelta(prev, productKey, -1)
        if (next === prev) return prev
        const modeForTier = scheduleMode
        return retierPreservingManual(next, modeForTier)
      })
    },
    [decrementFilmed, scheduleMode, retierPreservingManual],
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
        isFavorite: false,
        firstVideoDeadline: data.firstVideoDeadline?.trim()
          ? data.firstVideoDeadline.trim()
          : null,
      }

      setProducts((prev) => {
        if (data.videosFilmed > 0) {
          persistProductVideosFilmed(newProduct, data.videosFilmed)
        }
        const modeForTier = scheduleMode
        const combined = retierPreservingManual([...prev, newProduct], modeForTier)
        upsertCatalogFromMergedProducts([newProduct], 'manual')
        if (stage === 'schedule') {
          rebuildSchedule(
            combined,
            deadlineProducts,
            sprintConfig,
            excludedFromSchedule,
            modeForTier,
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
    setScheduleMode('sop')
    setSampleProducts([])
    setSprintConfig((prev) => ({
      videosPerDay: loadOnboardingProfile()?.videosPerDay ?? prev.videosPerDay,
      sprintDays: 7,
    }))
    resetFilmingProgress()
    // Clears live sprint workspace only — durable productCatalog is preserved.
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

      const historyLength = getUserDataSnapshot().sprintHistory.length
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

      const userId = getActiveUserId()
      const isFirstEverSprint = historyLength === 0 && !review.hasPreviousSprint
      if (isFirstEverSprint && !hasSeenFirstSprintCelebration(userId)) {
        const videosFilmed = products.reduce((sum, product) => sum + (product.videosFilmed || 0), 0)
        const productsTested = products.filter((product) => (product.videosFilmed || 0) > 0).length
        setFirstSprintCelebration({
          videosFilmed,
          productsTested: productsTested > 0 ? productsTested : products.length,
        })
      }

      setSprintReview(review)
      setPendingSprintReset(resetKind)
    },
    [products, sprintConfig, scheduleMode, fileName, resetSprintState],
  )

  const handleFirstSprintCelebrationContinue = useCallback(() => {
    markFirstSprintCelebrationSeen(getActiveUserId())
    setFirstSprintCelebration(null)
  }, [])

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
    setScheduleMode('sop')
    setProducts([])
    // Seed the thin sample wrapper from durable catalog so products reappear visibly.
    setSampleProducts(
      activeCatalogProducts().map((product) => ({
        id: product.id,
        productName: product.displayName,
        brand: product.brand ?? '',
        dateReceived: product.dateReceived ?? new Date().toISOString().slice(0, 10),
        type: product.isFavorite ? 'favorite' : 'sample',
        ...(product.firstVideoDeadline
          ? { firstVideoDeadline: product.firstVideoDeadline }
          : {}),
      })),
    )
    setSchedule([])
    setFileName(null)
    setUploadLandingMode('routed')
    setStage('sample')
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
    // Dual-write into durable catalog, then build the sprint FROM the catalog
    // (form list = sprint-level selection; removals exclude from this sprint only).
    upsertCatalogFromSampleProducts(items)
    const selectedIds = new Set(items.map((item) => item.id))
    const fromCatalog = buildSprintProductsFromCatalog().filter((product) =>
      selectedIds.has(product.id),
    )
    setProducts(fromCatalog)
    setScheduleMode('sop')
    setDeadlineProducts([])
    setExcludedFromSchedule(new Set())
    setStage('config')
    saveCurrentSprintStart(fromCatalog, sprintConfig, 'sop', null)
  }, [saveCurrentSprintStart, sprintConfig])

  /** Empty-state / Start Over: resume scheduling from durable catalog products. */
  const handleContinueWithCatalog = useCallback(() => {
    const fromCatalog = buildSprintProductsFromCatalog()
    if (fromCatalog.length === 0) {
      handleEnterSampleMode()
      return
    }
    setSampleProducts([])
    setProducts(fromCatalog)
    setScheduleMode('sop')
    setDeadlineProducts([])
    setExcludedFromSchedule(new Set())
    setFileName(null)
    setUploadLandingMode('routed')
    setShowProductEntry(false)
    setStage('dashboard')
    saveCurrentSprintStart(fromCatalog, sprintConfig, 'sop', null)
  }, [handleEnterSampleMode, saveCurrentSprintStart, sprintConfig])

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

  const topEarnerLine = usesSilentMomentum ? formatTopEarnerLine(products) : null

  const productFlags = useMemo(() => {
    const completedSprintEnds = getUserDataSnapshot().sprintHistory.map(
      (record) => record.endSnapshot,
    )
    return buildProductFlags(completedSprintEnds, products)
  }, [products])

  const uploadReminder = useMemo(() => {
    void engagementTick
    try {
      const engagement = getUserDataSnapshot().userEngagement
      const show = shouldShowUploadReminderBanner({
        lastCsvUploadAt: engagement.lastCsvUploadAt,
        sprintDays: sprintConfig.sprintDays,
        dismissedAt: engagement.uploadReminderDismissedAt,
      })
      if (!show || !engagement.lastCsvUploadAt) return null
      return {
        daysSinceUpload: daysBetween(engagement.lastCsvUploadAt),
        sprintDays: sprintConfig.sprintDays,
      }
    } catch {
      return null
    }
  }, [engagementTick, sprintConfig.sprintDays])

  const handleDismissUploadReminder = useCallback(() => {
    dismissUploadReminderBanner()
    setEngagementTick((tick) => tick + 1)
  }, [])

  const handleUploadReminderCta = useCallback(() => {
    setMainSection('sprint')
    navigate(appPathForSection('sprint'))
    setUploadLandingMode('routed')
    setStage('upload')
    setShowUploadPanel(true)
    setShowProductEntry(false)
  }, [navigate])

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

  const handleSectionChange = useCallback(
    (section: MainSection) => {
      setMainSection(section)
      navigate(appPathForSection(section))
    },
    [navigate],
  )

  const handleGoHome = useCallback(() => {
    setMainSection('home')
    navigate(appPathForSection('home'))
  }, [navigate])

  // Keep section state in sync with the URL (reload, back/forward, deep links).
  useEffect(() => {
    const parsed = parseAppSectionPath(location.pathname)
    if (parsed === 'invalid') {
      navigate(appPathForSection('home'), { replace: true })
      return
    }
    if (parsed === null) {
      const fallback = resolveSectionForBareApp()
      navigate(appPathForSection(fallback), { replace: true })
      return
    }
    setMainSection(parsed)
  }, [location.pathname, navigate, resolveSectionForBareApp])

  const handleSignOut = useCallback(async () => {
    const result = await signOut()
    if (!result.error) {
      navigate('/', { replace: true })
    }
  }, [navigate, signOut])

  const handleAddRetainerFromEmpty = useCallback(() => {
    setOpenNewRetainerDeal(true)
    setMainSection('retainers')
    navigate(appPathForSection('retainers'))
  }, [navigate])

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
        <>
          {uploadReminder && (
            <UploadReminderBanner
              daysSinceUpload={uploadReminder.daysSinceUpload}
              sprintDays={uploadReminder.sprintDays}
              onUpload={handleUploadReminderCta}
              onDismiss={handleDismissUploadReminder}
            />
          )}
          <DashboardHome
            sprint={dashboardPreviews.sprint}
            retainers={dashboardPreviews.retainers}
            income={dashboardPreviews.income}
            productScout={dashboardPreviews.productScout}
            onNavigate={handleSectionChange}
          />
        </>
      ) : mainSection === 'retainers' ? (
        <RetainerDeals
          deals={brandDeals}
          dailyPostingVolume={dailyPostingVolume}
          onAddDeal={addDeal}
          onUpdateDeal={updateDeal}
          onMoveDeal={moveDeal}
          onRemoveDeal={removeDeal}
          onToggleChecklist={toggleChecklistItem}
          onLoadCaptionMatchDemo={handleLoadCaptionMatchDemo}
          openNewDealRequest={openNewRetainerDeal}
          onNewDealOpenHandled={() => setOpenNewRetainerDeal(false)}
        />
      ) : mainSection === 'income' ? (
        <IncomeTracker />
      ) : mainSection === 'product-scout' ? (
        <ProductScout
          entries={productScoutEntries}
          persistError={productScoutPersistError}
          onClearPersistError={clearProductScoutPersistError}
          onAddEntry={async (productName, metrics) => {
            const entry = addProductScoutEntry({ productName, metrics })
            const { error } = await persistProductScoutNow()
            if (error) {
              // Keep the in-memory entry so the user can retry; surface the real error.
              throw new Error(error)
            }
            return entry
          }}
          onUpdateEntry={async (id, patch) => {
            updateProductScoutEntry(id, patch)
            const { error } = await persistProductScoutNow()
            if (error) {
              throw new Error(error)
            }
          }}
          onRemoveEntry={async (id) => {
            removeProductScoutEntry(id)
            const { error } = await persistProductScoutNow()
            if (error) {
              throw new Error(error)
            }
          }}
        />
      ) : mainSection === 'sprint' && !onboardingComplete ? (
        <OnboardingQuiz onComplete={handleOnboardingComplete} embedded />
      ) : (
        <>
          {uploadReminder && (
            <UploadReminderBanner
              daysSinceUpload={uploadReminder.daysSinceUpload}
              sprintDays={uploadReminder.sprintDays}
              onUpload={handleUploadReminderCta}
              onDismiss={handleDismissUploadReminder}
            />
          )}
          {showSprintEmptyState ? (
        <SprintEmptyState
          onAddSamples={handleEnterSampleMode}
          onUploadReport={() => setShowUploadPanel(true)}
          onAddRetainerDeal={handleAddRetainerFromEmpty}
          catalogProductCount={activeCatalogProducts().length}
          onContinueWithCatalog={handleContinueWithCatalog}
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
            isProcessing={isProcessing}
            showAlternatePaths={false}
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
        />
      )}



      {stage === 'dashboard' && (
        <div className="space-y-8 fade-in">
          {fileName && (
            <p className="font-body text-sm font-medium text-emerald">Report analyzed ✓</p>
          )}
          {isBeginnerMode && !usesSilentMomentum && (
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
            {isBeginnerMode && !usesSilentMomentum && (
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
            beginnerMode={isBeginnerMode && !usesSilentMomentum}
            advancedControlsOpen={showAdvancedControls}
            stalledKeys={productFlags.stalled}
            slowingAnchorKeys={productFlags.slowingAnchors}
            onVideosFilmedChange={handleVideosFilmedChange}
            onInRotationChange={handleInRotationChange}
            onMarkTrialPreviouslyCompleted={handleMarkTrialPreviouslyCompleted}
          />
          {!isBeginnerMode && !usesSilentMomentum && (
            <p className="font-body text-xs text-stone">
              New Test products get a 6-video trial before low performers can move to Cut. If you
              already tested a product before CreatorExec, use &quot;Already tested this
              product?&quot; to skip that trial and tier from this CSV&apos;s sales data. Uncheck
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
          {isBeginnerMode && !usesSilentMomentum && (
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
          onChange={handleSprintConfigChange}
          onSubmit={handleGenerateSchedule}
          onBack={() => setStage('dashboard')}
        />
      )}

      {(stage === 'schedule' || showRetainerOnlySchedule) && (
        <FilmingSchedule
          schedule={schedule}
          products={products}
          beginnerMode={isBeginnerMode && !usesSilentMomentum}
          momentumMode={false}
          getFilmedCount={getFilmedCount}
          onFilmedIncrement={handleScheduleFilmedIncrement}
          onFilmedDecrement={handleScheduleFilmedDecrement}
          onRemoveFromSchedule={handleRemoveFromSchedule}
          onBack={
            showRetainerOnlySchedule ? () => {} : () => setStage('config')
          }
          onStartOver={
            showRetainerOnlySchedule ? handleAddProductsFromRetainer : handleStartOver
          }
          retainerOnly={showRetainerOnlySchedule}
        />
      )}

      {showAddProductModal && (
        <AddProductModal
          onClose={() => setShowAddProductModal(false)}
          onSubmit={handleAddManualProduct}
        />
      )}

      {firstSprintCelebration && (
        <FirstSprintCelebration
          videosFilmed={firstSprintCelebration.videosFilmed}
          productsTested={firstSprintCelebration.productsTested}
          onContinue={handleFirstSprintCelebrationContinue}
        />
      )}

      {sprintReview && !firstSprintCelebration && (
        <SprintReviewModal review={sprintReview} onContinue={handleSprintReviewContinue} />
      )}

      {alreadyTestedNotice && (
        <AlreadyTestedToast
          key={`${alreadyTestedNotice.productName}-${alreadyTestedNotice.nextTier}`}
          notice={alreadyTestedNotice}
          onDismiss={dismissAlreadyTestedNotice}
        />
      )}
        </>
      )}

      {/* App-root interrupt — must render on every section (esp. Retainers after demo seed). */}
      {showCaptionMatchModal && captionMatchSuggestion && (
        <CaptionMatchConfirmModal
          suggestion={captionMatchSuggestion}
          remainingAfterCurrent={captionMatchRemainingAfter}
          onConfirm={handleCaptionMatchConfirm}
          onDecline={handleCaptionMatchDecline}
        />
      )}
    </AppShell>
  )
}
