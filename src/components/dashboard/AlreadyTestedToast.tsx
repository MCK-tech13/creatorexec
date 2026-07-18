import { useEffect, useState } from 'react'
import type { Tier } from '../../types'

export interface AlreadyTestedNotice {
  productName: string
  previousTier: Tier
  nextTier: Tier
}

interface AlreadyTestedToastProps {
  notice: AlreadyTestedNotice
  onDismiss: () => void
  durationMs?: number
}

function messageFor(notice: AlreadyTestedNotice): { title: string; detail: string } {
  const { productName, nextTier } = notice

  if (nextTier === 'Cut') {
    return {
      title: `${productName} moved to Cut`,
      detail: 'Trial skipped — ranked from this CSV’s sales data.',
    }
  }

  if (nextTier === 'Rising' || nextTier === 'Anchor') {
    return {
      title: `${productName} moved to ${nextTier}`,
      detail: 'Trial skipped — ranked from this CSV’s sales data.',
    }
  }

  return {
    title: `${productName}: trial skipped`,
    detail: 'Still Test based on this CSV’s sales volume — no guaranteed trial videos.',
  }
}

export function AlreadyTestedToast({
  notice,
  onDismiss,
  durationMs = 5200,
}: AlreadyTestedToastProps) {
  const [leaving, setLeaving] = useState(false)
  const { title, detail } = messageFor(notice)

  useEffect(() => {
    const leaveAt = window.setTimeout(() => setLeaving(true), durationMs - 320)
    const removeAt = window.setTimeout(onDismiss, durationMs)
    return () => {
      window.clearTimeout(leaveAt)
      window.clearTimeout(removeAt)
    }
  }, [durationMs, onDismiss])

  return (
    <div
      className={`pointer-events-none fixed bottom-6 right-4 z-[60] w-[min(100%-2rem,22rem)] sm:right-6 ${
        leaving ? 'celebration-toast-leave' : 'celebration-toast-enter'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="border border-border-warm bg-cream-warm px-4 py-3 shadow-[0_12px_40px_rgba(26,26,26,0.08)] sm:px-5 sm:py-4">
        <p className="font-display text-lg leading-snug text-ink sm:text-xl">{title}</p>
        <p className="mt-1 font-body text-xs text-stone">{detail}</p>
      </div>
    </div>
  )
}
