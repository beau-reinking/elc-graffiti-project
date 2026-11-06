import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  base: './',
  define: { __GT_VENUES__: process.env.GT_LAUNCH_VENUES || '[]', __GT_WEB__: JSON.stringify(process.env.GT_WEB_BUILD === '1') },
  envDir: root,
  server: { fs: { allow: [root] } },
  resolve: {
    alias: ['local', 'decentralized'].map(kind => ({
      find: new RegExp(`^@graffiti-garden/implementation-${kind}$`),
      replacement: `${root}node_modules/@graffiti-garden/implementation-${kind}/dist/browser/index.js`,
    })),
  },
});
