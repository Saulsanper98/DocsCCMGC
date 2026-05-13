import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseTarget = env.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? ''

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // En desarrollo el cliente usa `http://localhost:<puerto>/sb` como base; Vite reenvía a
    // Supabase. Así el navegador solo ve mismo origen y no aplica CORS al API (Auth/REST/Realtime).
    server: {
      host: true,
      ...(supabaseTarget
        ? {
            proxy: {
              '/sb': {
                target: supabaseTarget,
                changeOrigin: true,
                secure: true,
                ws: true,
                rewrite: (p: string) => p.replace(/^\/sb/, ''),
              },
            },
          }
        : {}),
    },
  }
})
