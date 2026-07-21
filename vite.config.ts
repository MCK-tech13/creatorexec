import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const commitSha =
  process.env.VITE_VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  'dev'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Ensure the client version guard always has a comparable SHA in Production.
    'import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA': JSON.stringify(commitSha),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4242',
        changeOrigin: true,
      },
    },
  },
})
