import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves this project under /1n/, while Vercel serves it at /.
  base: process.env.GITHUB_PAGES === 'true' ? '/1n/' : '/',
  plugins: [react()],
});
