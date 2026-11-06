import {defineConfig} from 'vite';
export default defineConfig({build:{rollupOptions:{input:{main:'index.html',design:'design.html'},output:{manualChunks(id){if(id.includes('node_modules/lucide'))return 'icons';if(id.includes('node_modules'))return 'graffiti'}}}}});
