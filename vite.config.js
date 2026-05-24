import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// When deploying to GitHub Pages at https://USER.github.io/foresight-analytics/
// the assets need to load from /foresight-analytics/. For local dev (npm run
// dev) we use '/'. We set BASE_PATH at build time only.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/foresight-analytics/' : '/',
  server: { port: 5173, open: true },
}));
