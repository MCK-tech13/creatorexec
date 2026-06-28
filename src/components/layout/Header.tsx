import { Sparkles } from 'lucide-react'

export function Header() {
  return (
    <header className="border-b border-border-warm bg-cream-card shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald">
          <Sparkles className="h-5 w-5 text-cream" />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-wide text-ink">
            CreatorExec
          </h1>
          <p className="font-tagline text-stone">Your TikTok Shop Operating System</p>
        </div>
      </div>
    </header>
  )
}
