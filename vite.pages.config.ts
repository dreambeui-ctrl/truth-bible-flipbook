import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: process.env.PAGES_BASE_PATH || '/',
  root: path.join(projectRoot, 'static-site'),
  publicDir: path.join(projectRoot, 'public'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': projectRoot,
      'next/image': path.join(projectRoot, 'static-site/next-image.tsx'),
    },
  },
  build: {
    outDir: path.join(projectRoot, 'dist-pages'),
    emptyOutDir: true,
  },
});
