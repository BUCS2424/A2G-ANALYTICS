import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev server is reachable at http://a2ganalytics.localhost:5173 (per project
// convention); /api and /js are proxied to the FastAPI backend on :8000 so
// the browser only ever talks to one origin during local development.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/js': 'http://127.0.0.1:8000',
    },
  },
})
