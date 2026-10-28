import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const mediaBaseUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_MEDIA_URL
  return {
    // Keep browser modules separate from config-less SSR tools and test runners.
    cacheDir: 'node_modules/.vite/app',
    plugins: [react(), tailwindcss()],
    // The media bucket need not grant CORS access to every local preview origin.
    // Proxy only to the configured media host; production still uses its CDN URL.
    server: {
      proxy: mediaBaseUrl ? {
        '/__media': {
          target: mediaBaseUrl.replace(/\/+$/, ''),
          changeOrigin: true,
          rewrite: path => path.replace(/^\/__media/, ''),
        },
      } : undefined,
    },
  }
})
