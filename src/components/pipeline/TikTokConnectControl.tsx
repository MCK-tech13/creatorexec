import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  disconnectTikTok,
  fetchTikTokConnection,
  startTikTokOAuth,
  type TikTokConnectionPublic,
} from '../../lib/tiktok/api'

export function TikTokConnectControl() {
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [connection, setConnection] = useState<TikTokConnectionPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const status = searchParams.get('tiktok')
    if (!status) return

    if (status === 'connected') {
      setMessage('TikTok connected.')
    } else if (status === 'error') {
      const reason = searchParams.get('reason')
      setError(reason ? `TikTok connect failed: ${reason}` : 'TikTok connect failed.')
    }

    const next = new URLSearchParams(searchParams)
    next.delete('tiktok')
    next.delete('reason')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const token = session?.access_token
    if (!token) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void fetchTikTokConnection(token)
      .then((row) => {
        if (!cancelled) setConnection(row)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load TikTok connection')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session?.access_token])

  const handleConnect = async () => {
    const token = session?.access_token
    if (!token) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const url = await startTikTokOAuth(token)
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start TikTok connect')
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    const token = session?.access_token
    if (!token) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await disconnectTikTok(token)
      setConnection(null)
      setMessage('TikTok disconnected.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect TikTok')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      {loading ? (
        <p className="font-body text-xs text-stone">Checking TikTok…</p>
      ) : connection ? (
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2">
            {connection.avatarUrl ? (
              <img
                src={connection.avatarUrl}
                alt=""
                className="h-8 w-8 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center border border-border-warm bg-terracotta-tint font-body text-xs font-semibold text-emerald">
                TT
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-body text-sm font-medium text-ink">
                {connection.displayName || 'TikTok connected'}
              </p>
              <p className="font-body text-xs text-stone">Connected</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleDisconnect()}
            disabled={busy}
            className="btn-outline px-4 py-2.5 text-sm disabled:opacity-60"
          >
            {busy ? 'Working…' : 'Disconnect'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleConnect()}
          disabled={busy || !session?.access_token}
          className="btn-outline inline-flex w-full items-center justify-center px-4 py-2.5 text-sm sm:w-auto disabled:opacity-60"
        >
          {busy ? 'Redirecting…' : 'Connect TikTok'}
        </button>
      )}
      {message && <p className="font-body text-xs text-emerald">{message}</p>}
      {error && <p className="max-w-xs font-body text-xs text-terracotta sm:text-right">{error}</p>}
    </div>
  )
}
