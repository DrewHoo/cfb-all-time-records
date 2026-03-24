import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace 'cfb-all-time-records' with your actual GitHub repo name
export default defineConfig({
  plugins: [react()],
  base: '/cfb-all-time-records/',
})
