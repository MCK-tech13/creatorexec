import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer } from '../layout/PageContainer'
import { CreatorExecWordmark } from '../ui/CreatorExecWordmark'
import { SiteFooter } from '../layout/SiteFooter'

interface LegalDocumentLayoutProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

export function LegalDocumentLayout({ title, lastUpdated, children }: LegalDocumentLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-warm">
      <div className="border-b border-border-warm bg-white">
        <PageContainer className="max-w-3xl">
          <div className="flex items-center justify-between gap-4 py-4">
            <Link to="/">
              <CreatorExecWordmark as="p" variant="light" size="compact" />
            </Link>
            <Link to="/login" className="link-elegant font-body text-sm font-medium text-stone">
              Log in
            </Link>
          </div>
        </PageContainer>
      </div>

      <PageContainer className="max-w-3xl flex-1 py-10 sm:py-14">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
        <p className="label-caps mt-3 text-stone">Last updated: {lastUpdated}</p>
        <article className="mt-8 border border-border-warm bg-white p-6 sm:p-8">{children}</article>
      </PageContainer>

      <SiteFooter />
    </div>
  )
}

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className="font-body text-sm leading-relaxed text-stone sm:text-base">{children}</p>
}

function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 font-body text-sm leading-relaxed text-stone sm:text-base">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export { LegalSection, LegalParagraph, LegalList }
