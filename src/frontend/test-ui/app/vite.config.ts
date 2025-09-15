import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Use plain root base in dev for Vite to serve at '/'. For build, match backend-served path.
  base: command === 'serve' ? '/' : '/test-ui/dist/',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true,
    open: false,
    proxy: {
      '/open': 'http://localhost:8000',
      '/close': 'http://localhost:8000',
      '/write': 'http://localhost:8000',
      '/serial': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true
      }
    }
  }
}))
