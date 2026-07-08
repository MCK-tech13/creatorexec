import type { ElementType } from 'react'

export type CreatorExecWordmarkVariant = 'light' | 'dark'
export type CreatorExecWordmarkSize = 'header' | 'hero' | 'compact'

const SIZE_CLASSES: Record<CreatorExecWordmarkSize, string> = {
  /** App header — scales up on larger breakpoints without wrapping on mobile */
  header: 'text-[1.35rem] sm:text-3xl md:text-5xl lg:text-[3.5rem]',
  /** Landing / welcome hero */
  hero: 'text-[2rem] sm:text-5xl md:text-6xl',
  /** Tight spaces (nav chips, footers) */
  compact: 'text-lg sm:text-xl',
}

const VARIANT_CLASSES: Record<CreatorExecWordmarkVariant, string> = {
  light: 'text-emerald',
  dark: 'text-cream-warm',
}

interface CreatorExecWordmarkProps {
  variant?: CreatorExecWordmarkVariant
  size?: CreatorExecWordmarkSize
  as?: ElementType
  className?: string
}

export function CreatorExecWordmark({
  variant = 'light',
  size = 'header',
  as: Component = 'span',
  className = '',
}: CreatorExecWordmarkProps) {
  return (
    <Component
      className={`wordmark ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`.trim()}
    >
      CreatorExec
    </Component>
  )
}
