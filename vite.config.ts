import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base + HashRouter means the build works on GitHub Pages
// under any repo name, with no 404 redirect tricks.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Firebase and React change rarely; separate files let browsers keep them cached between deploys.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
