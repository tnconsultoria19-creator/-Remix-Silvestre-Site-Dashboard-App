import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import devServer from '@hono/vite-dev-server';

export default defineConfig(async () => {
  let bindings = {};
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { getPlatformProxy } = await import('wrangler');
      const proxy = await getPlatformProxy();
      bindings = proxy.env;
    } catch (e) {
      console.warn('Wrangler local proxy not ready');
    }
  }

  return {
    base: "/-Remix-Silvestre-Site-Dashboard-App/",
    plugins: [
      react(), 
      tailwindcss(),
      devServer({
        entry: 'src/backend/index.ts',
        injectClientScript: false,
        env: bindings
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
