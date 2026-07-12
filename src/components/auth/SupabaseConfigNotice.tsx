import { useAuth } from '../../contexts/AuthContext'

export function SupabaseConfigNotice({ children }: { children: React.ReactNode }) {
  const { configured } = useAuth()

  if (!configured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream-warm px-6 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Supabase not configured</h1>
        <p className="mt-4 max-w-md font-body text-sm text-stone">
          Set <code className="text-ink">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-ink">VITE_SUPABASE_ANON_KEY</code> in your environment.
        </p>
        <p className="mt-3 max-w-md font-body text-xs text-stone">
          Local dev: add them to <code>.env</code>. Production (Vercel): Project Settings →
          Environment Variables. See <code>docs/DEPLOYMENT.md</code>.
        </p>
      </div>
    )
  }

  return children
}
