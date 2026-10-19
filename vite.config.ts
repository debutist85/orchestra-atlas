import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Keep browser modules separate from config-less SSR tools and test runners.
  cacheDir: 'node_modules/.vite/app',
  plugins: [react(), tailwindcss()],
})
