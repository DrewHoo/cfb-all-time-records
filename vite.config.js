import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Multi-page build, served by GitHub Pages at https://drewhoover.com/cfb-all-time-records/:
//   /                 → the championship grid (index.html)
//   /football.html    → the FBS all-time records board
// `npm run build` runs scripts/prerender.mjs after this so both pages ship
// with their markup baked in. The share worker (workers/share) imports the
// same src/lib modules, so the words and ranks are the site's.
export default defineConfig({
  plugins: [react()],
  base: '/cfb-all-time-records/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        football: resolve(__dirname, 'football.html'),
      },
    },
  },
})
