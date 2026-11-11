import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // API calls go to the Express server (server/), started alongside by `npm run dev` at the root.
    proxy: { '/api': 'http://localhost:4000' },
  },
})
