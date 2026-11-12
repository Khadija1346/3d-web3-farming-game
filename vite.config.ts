import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Static SPA build: deployable to Netlify and wrappable by Capacitor for the Asta DAO app.
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 4000 },
})
