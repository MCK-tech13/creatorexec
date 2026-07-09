import { Loader2 } from 'lucide-react'
import { PageContainer } from '../layout/PageContainer'
import { CreatorExecWordmark } from '../ui/CreatorExecWordmark'

export function AuthLoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream-warm px-6">
      <CreatorExecWordmark as="p" variant="light" size="compact" />
      <div className="mt-8 flex items-center gap-3 font-body text-sm text-stone">
        <Loader2 className="h-5 w-5 animate-spin text-emerald" aria-hidden />
        <span>{label}</span>
      </div>
    </div>
  )
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-warm">
      <div className="border-b border-border-warm bg-white py-6">
        <PageContainer className="max-w-md">
          <CreatorExecWordmark as="p" variant="light" size="compact" />
        </PageContainer>
      </div>
      <PageContainer className="max-w-md flex-1 py-10 sm:py-14">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
        {subtitle && (
          <p className="mt-3 font-body text-sm leading-relaxed text-stone sm:text-base">{subtitle}</p>
        )}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 border-t border-border-warm pt-6">{footer}</div>}
      </PageContainer>
    </div>
  )
}
