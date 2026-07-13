import { SUPPORT_EMAIL } from '../../lib/support'

export function SupportEmailLink({ className = 'link-elegant text-ink' }: { className?: string }) {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className={className}>
      {SUPPORT_EMAIL}
    </a>
  )
}
