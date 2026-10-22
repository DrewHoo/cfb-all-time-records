import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// One page, served by GitHub Pages at https://drewhoover.com/cfb-all-time-records/.
// `npm run build` runs scripts/prerender.mjs after this so the page ships with
// its markup baked in. The share worker (workers/share) imports the same
// src/lib modules, so the words and ranks are the site's. public/football.html
// is the board's old address, a redirect to the root.
export default defineConfig({
  plugins: [react()],
  base: '/cfb-all-time-records/',
})
