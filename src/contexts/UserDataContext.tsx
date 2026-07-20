import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { AuthLoadingScreen } from '../components/auth/AuthScreens'
import {
  clearDataStore,
  hydrateDataStore,
  isDataStoreReady,
} from '../lib/supabase/dataStore'
import { fetchUserDataFromSupabase } from '../lib/supabase/fetchUserData'
import { getSupabaseClient } from '../lib/supabase/client'
import { migrateLocalStorageToSupabase } from '../lib/supabase/migrateLocalStorage'
import { flushUserDataPersist } from '../lib/supabase/sync'
import { backfillCatalogFromSprintState } from '../lib/catalog/productCatalogStorage'

interface UserDataContextValue {
  ready: boolean
  error: string | null
  reload: () => Promise<void>
}

const UserDataContext = createContext<UserDataContextValue | null>(null)

/** Bumps on each UserDataProvider user-scoped effect mount; gates late flush clears. */
let userDataProviderGeneration = 0

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadUserData = useCallback(async () => {
    if (!user || !session) {
      clearDataStore()
      setReady(false)
      setError(null)
      return
    }

    setReady(false)
    setError(null)

    try {
      const client = getSupabaseClient()
      await migrateLocalStorageToSupabase(client, user.id)
      const snapshot = await fetchUserDataFromSupabase(client, user.id)
      hydrateDataStore(user.id, snapshot)
      // Stage 1: one-time backfill of durable catalog from live sprint workspace.
      backfillCatalogFromSprintState({
        products: snapshot.currentSprintState?.products,
        sampleProducts: snapshot.currentSprintState?.sampleProducts,
      })
      setReady(true)
    } catch (loadError) {
      console.error('Failed to load user data', loadError)
      clearDataStore()
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load your saved data. Please try again.',
      )
      setReady(false)
    }
  }, [user, session])

  useEffect(() => {
    void loadUserData()
  }, [loadUserData])

  useEffect(() => {
    if (!user) return

    const generation = ++userDataProviderGeneration

    return () => {
      // Await flush BEFORE clearing. Previously flush was fire-and-forget then
      // clearDataStore() ran immediately — queued catalog persists read [] and
      // the old replace-all wipe deleted user_products on Start Over remounts.
      void flushUserDataPersist().finally(() => {
        if (generation === userDataProviderGeneration) {
          clearDataStore()
        }
      })
    }
  }, [user?.id])

  const value = useMemo<UserDataContextValue>(
    () => ({
      ready,
      error,
      reload: loadUserData,
    }),
    [ready, error, loadUserData],
  )

  if (!user) {
    return null
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
        <div className="max-w-md space-y-4">
          <h1 className="text-xl font-semibold">Could not load your data</h1>
          <p className="text-sm text-slate-300">{error}</p>
          <button
            type="button"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            onClick={() => void loadUserData()}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!ready || !isDataStoreReady()) {
    return <AuthLoadingScreen label="Loading your saved data…" />
  }

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>
}

export function useUserData(): UserDataContextValue {
  const context = useContext(UserDataContext)
  if (!context) {
    throw new Error('useUserData must be used within UserDataProvider')
  }
  return context
}
