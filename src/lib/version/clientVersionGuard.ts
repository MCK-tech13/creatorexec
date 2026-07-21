import { hasDirtyClientForms, subscribeClientFormDirty } from './formDirtyRegistry'

const VERSION_URL = '/version.json'
const POLL_INTERVAL_MS = 90_000
/** sessionStorage: last live SHA we already reloaded for (keyed per SHA, not a boolean). */
const RELOADED_FOR_SHA_KEY = 'ce-reloaded-for-version-sha'

export type VersionCheckResult = 'current' | 'stale' | 'unknown'

interface VersionPayload {
  sha?: string
}

let pollTimer: ReturnType<typeof setInterval> | null = null
let started = false
let pendingReload = false
let reloadInFlight = false
let dirtyUnsubscribe: (() => void) | null = null

function readLoadedSha(): string {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  const sha = env?.VITE_VERCEL_GIT_COMMIT_SHA
  if (typeof sha === 'string' && sha.length > 0) return sha
  return 'dev'
}

function readReloadedForSha(): string | null {
  try {
    return sessionStorage.getItem(RELOADED_FOR_SHA_KEY)
  } catch {
    return null
  }
}

function markReloadedForSha(liveSha: string): void {
  try {
    sessionStorage.setItem(RELOADED_FOR_SHA_KEY, liveSha)
  } catch {
    // ignore
  }
}

/**
 * Fetch the currently live Production SHA.
 * Cache-busted query + no-store so CDN/browser cannot serve a stale version.json.
 */
export async function fetchLiveVersionSha(): Promise<string | null> {
  try {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    const payload = (await response.json()) as VersionPayload
    if (typeof payload.sha === 'string' && payload.sha.length > 0) {
      return payload.sha
    }
    return null
  } catch {
    return null
  }
}

export function getLoadedClientSha(): string {
  return readLoadedSha()
}

export async function checkClientVersion(): Promise<VersionCheckResult> {
  const loaded = readLoadedSha()
  // Local/dev builds share "dev" — never force-reload in that mode.
  if (loaded === 'dev') return 'current'

  const live = await fetchLiveVersionSha()
  if (!live || live === 'dev') return 'unknown'
  if (live === loaded) return 'current'
  return 'stale'
}

function performReload(liveSha: string): void {
  if (reloadInFlight) return
  // SHA-keyed guard: skip only if we already reloaded *for this live SHA*.
  // A later deploy with a different SHA still triggers another reload.
  if (readReloadedForSha() === liveSha) return

  reloadInFlight = true
  pendingReload = false
  markReloadedForSha(liveSha)
  window.location.reload()
}

function requestReloadForLiveSha(liveSha: string): void {
  if (hasDirtyClientForms()) {
    pendingReload = true
    return
  }
  performReload(liveSha)
}

async function evaluateAndMaybeReload(): Promise<VersionCheckResult> {
  const loaded = readLoadedSha()
  if (loaded === 'dev') return 'current'

  const live = await fetchLiveVersionSha()
  if (!live || live === 'dev') return 'unknown'
  if (live === loaded) {
    pendingReload = false
    return 'current'
  }

  requestReloadForLiveSha(live)
  return 'stale'
}

/**
 * Gate for high-stakes writes (Product Scout submit).
 * Returns true if the bundle is current and the caller may proceed.
 * Returns false if a reload was triggered (caller must not persist).
 * Use `beforeReload` to persist drafts before navigation starts.
 */
export async function ensureClientVersionCurrent(options?: {
  beforeReload?: () => void
}): Promise<boolean> {
  const loaded = readLoadedSha()
  if (loaded === 'dev') return true

  const live = await fetchLiveVersionSha()
  if (!live || live === 'dev') return true
  if (live === loaded) return true

  options?.beforeReload?.()
  performReload(live)
  return false
}

function onVisibilityOrFocus(): void {
  if (document.visibilityState && document.visibilityState !== 'visible') return
  void evaluateAndMaybeReload()
}

function onDirtyCleared(): void {
  if (!pendingReload) return
  if (hasDirtyClientForms()) return
  void (async () => {
    const live = await fetchLiveVersionSha()
    if (!live || live === 'dev') return
    if (live === readLoadedSha()) {
      pendingReload = false
      return
    }
    performReload(live)
  })()
}

/** Start poll + focus listeners. Safe to call once from the app shell. */
export function startClientVersionGuard(): () => void {
  if (started) {
    return () => {}
  }
  started = true

  void evaluateAndMaybeReload()
  pollTimer = setInterval(() => {
    void evaluateAndMaybeReload()
  }, POLL_INTERVAL_MS)

  window.addEventListener('focus', onVisibilityOrFocus)
  document.addEventListener('visibilitychange', onVisibilityOrFocus)
  dirtyUnsubscribe = subscribeClientFormDirty(onDirtyCleared)

  return () => {
    started = false
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    window.removeEventListener('focus', onVisibilityOrFocus)
    document.removeEventListener('visibilitychange', onVisibilityOrFocus)
    dirtyUnsubscribe?.()
    dirtyUnsubscribe = null
  }
}
