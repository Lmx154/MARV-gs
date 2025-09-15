import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Vite configuration for MARV GUI
// - base './' so built assets use relative URLs, allowing serving from '/gui/'
// - outDir '../gui' to emit into src/frontend/gui (packaged by PyInstaller)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../gui',
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ['dockview', 'three', '@react-three/fiber', '@react-three/drei', 'react-leaflet', 'leaflet']
  },
  define: {
    global: 'globalThis',
  },
  server: {
    host: true,
    port: 5173,
    // Optionally proxy API to FastAPI during dev
    proxy: {
      '/open': 'http://localhost:8000',
      '/close': 'http://localhost:8000',
      '/write': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  }
});