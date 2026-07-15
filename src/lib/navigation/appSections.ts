import type { MainSection } from '../../types'

/** URL segment ↔ MainSection mapping (stable, bookmarkable). */
export const APP_SECTION_PATHS: Record<MainSection, string> = {
  home: 'home',
  sprint: 'sprint',
  retainers: 'retainers',
  income: 'income',
  'product-scout': 'product-scout',
}

const PATH_TO_SECTION = Object.fromEntries(
  Object.entries(APP_SECTION_PATHS).map(([section, path]) => [path, section]),
) as Record<string, MainSection>

export function appPathForSection(section: MainSection): string {
  return `/app/${APP_SECTION_PATHS[section]}`
}

/**
 * Parse `/app` or `/app/:section`.
 * - `null` → bare `/app` (no section segment)
 * - `MainSection` → valid section
 * - `'invalid'` → `/app/something-unknown`
 */
export function parseAppSectionPath(
  pathname: string,
): MainSection | null | 'invalid' {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  if (normalized === '/app') return null

  const match = /^\/app\/([^/]+)$/.exec(normalized)
  if (!match) return 'invalid'

  const section = PATH_TO_SECTION[match[1]]
  return section ?? 'invalid'
}

export function isMainSection(value: string): value is MainSection {
  return value in APP_SECTION_PATHS
}
