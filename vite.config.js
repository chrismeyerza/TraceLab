import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// When deploying to GitHub Pages at https://USER.github.io/TraceLab/
// the assets need to load from /TraceLab/. For local dev (npm run
// dev) we use '/'. We set BASE_PATH at build time only.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/TraceLab/' : '/',
  server: { port: 5173, open: true },
}));
