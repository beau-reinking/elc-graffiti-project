import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig(({mode})=>({define:{__GT_WEB__:JSON.stringify(mode==='web')},build:{target:'es2022',rollupOptions:{input:process.env.GT_RELEASE_PREVIEW==='true'?{main:'index.html',qa:'qa.html',access:'qa-access.html'}:'index.html'}},resolve:{alias:['local','decentralized'].map(kind=>({find:`@graffiti-garden/implementation-${kind}`,replacement:fileURLToPath(new URL(`./node_modules/@graffiti-garden/implementation-${kind}/dist/browser/index.js`,import.meta.url))}))}}));
