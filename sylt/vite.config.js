import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@graffiti-garden/implementation-decentralized': fileURLToPath(new URL(
        './node_modules/@graffiti-garden/implementation-decentralized/dist/browser/index.js',
        import.meta.url,
      )),
    },
  },
  build: {
    rollupOptions: {
      input: mode === 'standalone' ? 'index.html' : { main: 'index.html', design: 'design.html' },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/lucide')) return 'icons';
          if (id.includes('node_modules')) return 'graffiti';
        },
      },
    },
  },
}));
