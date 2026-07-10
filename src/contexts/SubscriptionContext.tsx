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
import {
  evaluateSubscriptionAccess,
  hasAppAccess,
  isReadOnlyAccess,
  type SubscriptionAccess,
  type UserSubscription,
} from '../lib/billing/subscription'
import { fetchUserSubscription } from '../lib/billing/api'

interface SubscriptionContextValue {
  subscription: UserSubscription | null
  access: SubscriptionAccess
  loading: boolean
  error: string | null
  canAccessApp: boolean
  isReadOnly: boolean
  reload: () => Promise<void>
}

const defaultAccess = evaluateSubscriptionAccess(null)

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth()
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user) {
      setSubscription(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const next = await fetchUserSubscription(user.id)
      setSubscription(next)
    } catch (loadError) {
      console.error('Failed to load subscription', loadError)
      setSubscription(null)
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load subscription status.',
      )
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload, session?.access_token])

  const access = useMemo(
    () => (loading ? { ...defaultAccess, reason: 'loading' as const } : evaluateSubscriptionAccess(subscription)),
    [loading, subscription],
  )

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      subscription,
      access,
      loading,
      error,
      canAccessApp: hasAppAccess(access),
      isReadOnly: isReadOnlyAccess(access),
      reload,
    }),
    [subscription, access, loading, error, reload],
  )

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider')
  }
  return context
}
