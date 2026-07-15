import { Upload, X } from 'lucide-react'

interface UploadReminderBannerProps {
  daysSinceUpload: number
  sprintDays: number
  onUpload: () => void
  onDismiss: () => void
}

export function UploadReminderBanner({
  daysSinceUpload,
  sprintDays,
  onUpload,
  onDismiss,
}: UploadReminderBannerProps) {
  return (
    <div
      className="mb-6 border border-border-warm bg-white px-4 py-3 sm:px-5 sm:py-4"
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center border border-border-warm bg-terracotta-tint text-emerald">
          <Upload className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-medium text-ink sm:text-base">
            It&apos;s been a while since your last upload — ready to start a new sprint?
          </p>
          <p className="mt-1 font-body text-xs leading-relaxed text-stone sm:text-sm">
            {daysSinceUpload} days since your last commission report (your sprint is{' '}
            {sprintDays} days).
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onUpload} className="btn-primary px-4 py-2 text-sm">
              Upload new report
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="link-elegant font-body text-sm text-stone"
            >
              Dismiss
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-stone transition hover:text-ink"
          aria-label="Dismiss upload reminder"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
