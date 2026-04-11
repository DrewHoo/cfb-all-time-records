import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Multi-page build:
//   /                 → Championship Grid (index.html)
//   /football.html    → College Football Records table
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
