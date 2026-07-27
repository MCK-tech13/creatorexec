import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { hasPasswordRecoveryInUrl } from '../../lib/auth/passwordReset'
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase/client'

/**
 * If a recovery link lands on `/` (or any non-reset route), send the user to
 * `/reset-password` while preserving the hash/query tokens.
 */
export function PasswordRecoveryRedirect() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    function goToReset(search: string, hash: string, pathname: string) {
      if (pathname === '/reset-password') return
      navigate(`/reset-password${search}${hash}`, { replace: true })
    }

    if (hasPasswordRecoveryInUrl(location)) {
      goToReset(location.search, location.hash, location.pathname)
    }

    const supabase = getSupabaseClient()
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        goToReset(location.search, location.hash, location.pathname)
      }
    })

    return () => data.subscription.unsubscribe()
  }, [navigate, location])

  return null
}
