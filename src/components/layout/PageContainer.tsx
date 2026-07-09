import type { ReactNode } from 'react'

export type PageContainerVariant = 'narrow' | 'wide'

interface PageContainerProps {
  children: ReactNode
  className?: string
  variant?: PageContainerVariant
}

const VARIANT_CLASS: Record<PageContainerVariant, string> = {
  narrow: 'mx-auto w-full max-w-xl px-5 sm:px-8',
  wide: 'mx-auto w-full max-w-7xl px-5 sm:px-8',
}

/** Shared content column — narrow for reading screens, wide for data-dense views. */
export function PageContainer({
  children,
  className = '',
  variant = 'narrow',
}: PageContainerProps) {
  return (
    <div className={`${VARIANT_CLASS[variant]} ${className}`.trim()}>{children}</div>
  )
}
