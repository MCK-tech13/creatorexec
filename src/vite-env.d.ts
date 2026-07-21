/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_STRIPE_TEST_MODE?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  /** Injected by Vercel at build time — used by the client version guard. */
  readonly VITE_VERCEL_GIT_COMMIT_SHA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
