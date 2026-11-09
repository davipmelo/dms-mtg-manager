import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api-mpcfill': {
        target: 'https://mpcfill.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-mpcfill/, ''),
        headers: {
          Referer: 'https://mpcfill.com/editor',
          Origin: 'https://mpcfill.com',
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          icons: ['lucide-react'],
          pdf: ['jspdf'],
        },
      },
    },
  },
});
