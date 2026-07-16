export type TikTokConnectionPublic = {
  connected: true
  openId: string
  displayName: string | null
  avatarUrl: string | null
  scope: string | null
  connectedAt: string
}

export async function fetchTikTokConnection(
  accessToken: string,
): Promise<TikTokConnectionPublic | null> {
  const response = await fetch('/api/tiktok/connection', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = (await response.json()) as {
    connection?: TikTokConnectionPublic | null
    error?: string
  }
  if (!response.ok) {
    throw new Error(payload.error ?? 'Could not load TikTok connection')
  }
  return payload.connection ?? null
}

export async function startTikTokOAuth(accessToken: string): Promise<string> {
  const response = await fetch('/api/tiktok/oauth/start', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })

  const payload = (await response.json()) as { url?: string; error?: string }
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? 'Could not start TikTok connect')
  }
  return payload.url
}

export async function disconnectTikTok(accessToken: string): Promise<void> {
  const response = await fetch('/api/tiktok/disconnect', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })

  const payload = (await response.json()) as { ok?: boolean; error?: string }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? 'Could not disconnect TikTok')
  }
}
