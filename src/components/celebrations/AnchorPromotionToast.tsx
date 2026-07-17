import { useEffect, useState } from 'react'

interface AnchorPromotionToastProps {
  productName: string
  onDismiss: () => void
  /** Auto-dismiss delay in ms */
  durationMs?: number
}

const CONFETTI_COLORS = ['#1a4a3a', '#c1633f', '#faf7f2', '#245a48', '#d4846a']

export function AnchorPromotionToast({
  productName,
  onDismiss,
  durationMs = 3800,
}: AnchorPromotionToastProps) {
  const [leaving, setLeaving] = useState(false)

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
      <div className="relative overflow-hidden border border-emerald/25 bg-cream-warm px-4 py-3 shadow-[0_12px_40px_rgba(26,26,26,0.08)] sm:px-5 sm:py-4">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {CONFETTI_COLORS.map((color, index) => (
            <span
              key={`${color}-${index}`}
              className="celebration-confetti"
              style={{
                left: `${12 + index * 18}%`,
                backgroundColor: color,
                animationDelay: `${index * 45}ms`,
              }}
            />
          ))}
        </div>
        <p className="relative font-display text-lg leading-snug text-ink sm:text-xl">
          <span aria-hidden>🎉 </span>
          {productName} just hit Anchor tier!
        </p>
        <p className="relative mt-1 font-body text-xs text-stone">Keep the momentum going.</p>
      </div>
    </div>
  )
}
