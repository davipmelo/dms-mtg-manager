import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const mpcProxy = {
  '/api-mpcfill': {
    target: 'https://mpcfill.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api-mpcfill/, ''),
    headers: {
      Referer: 'https://mpcfill.com/editor',
      Origin: 'https://mpcfill.com',
    },
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: false,
    proxy: mpcProxy,
  },
  preview: {
    port: 5173,
    proxy: mpcProxy,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          icons: ['lucide-react'],
          pdf: ['jspdf'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
});
