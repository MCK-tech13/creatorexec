/**
 * MemoryRouter smoke test: /app/:section routes resolve without auth/data providers.
 * Confirms React Router path matching for reload deep-links.
 */
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
  useParams,
} from 'react-router-dom'
import {
  appPathForSection,
  parseAppSectionPath,
} from '../src/lib/navigation/appSections.ts'
import type { MainSection } from '../src/types/index.ts'

function Probe() {
  const location = useLocation()
  const params = useParams()
  const parsed = parseAppSectionPath(location.pathname)
  return createElement(
    'div',
    {
      'data-pathname': location.pathname,
      'data-param': params.section ?? '',
      'data-parsed': parsed === null ? 'bare' : String(parsed),
    },
    `${location.pathname}|${params.section ?? ''}|${parsed === null ? 'bare' : parsed}`,
  )
}

const SECTIONS: MainSection[] = ['home', 'sprint', 'retainers', 'income', 'product-scout']

for (const section of SECTIONS) {
  const path = appPathForSection(section)
  const router = createMemoryRouter(
    [
      {
        path: '/app',
        children: [
          { index: true, element: createElement(Probe) },
          { path: ':section', element: createElement(Probe) },
        ],
      },
    ],
    { initialEntries: [path] },
  )

  const html = renderToStaticMarkup(createElement(RouterProvider, { router }))
  assert.match(html, new RegExp(`data-pathname="${path}"`))
  assert.match(html, new RegExp(`data-param="${section}"`))
  assert.match(html, new RegExp(`data-parsed="${section}"`))
  console.log(`  ✓ MemoryRouter reload ${path} → section=${section}`)
}

{
  const router = createMemoryRouter(
    [
      {
        path: '/app',
        children: [
          { index: true, element: createElement(Probe) },
          { path: ':section', element: createElement(Probe) },
        ],
      },
    ],
    { initialEntries: ['/app'] },
  )
  const html = renderToStaticMarkup(createElement(RouterProvider, { router }))
  assert.match(html, /data-pathname="\/app"/)
  assert.match(html, /data-parsed="bare"/)
  console.log('  ✓ MemoryRouter /app → bare (Caller redirects to home/sprint)')
}

console.log('verify-app-section-routes-router: MemoryRouter deep-link checks passed')
