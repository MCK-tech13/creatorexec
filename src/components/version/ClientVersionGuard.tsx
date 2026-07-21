import { useEffect } from 'react'
import { startClientVersionGuard } from '../../lib/version/clientVersionGuard'

/** Mounts the client deploy-SHA guard (poll + focus). Renders nothing. */
export function ClientVersionGuard() {
  useEffect(() => startClientVersionGuard(), [])
  return null
}
