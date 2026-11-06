import {spawnSync} from 'node:child_process';
import {mkdir,cp,rm,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {configuration} from './config.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),profile=process.argv[2]||'production';
if(!['production','staging','preview'].includes(profile))throw Error('Unknown build profile.');
for(const name of ['FFMPEG-WRAPPER-MIT.txt','FFMPEG-CORE-GPL-2.0.txt','ENCODER-SOURCE.md','DMSANS-OFL.txt','MANROPE-OFL.txt'])if((await stat(path.join(root,'licenses',name))).size<100)throw Error(`Missing dependency notice: ${name}`);
const config=await configuration(profile),workspace=path.join(root,'GTGraffitiLauncher/workspace'),out=path.join(root,'dist-web');
function run(dir,args,env={}){const r=spawnSync(process.execPath,args,{cwd:path.join(root,dir),stdio:'inherit',env:{...process.env,...env,GT_WEB_BUILD:'1',GT_LAUNCH_VENUES:JSON.stringify(config.venues),GT_RELEASE_PREVIEW:String(profile!=='production'),VITE_MODERATOR_ACTOR:config.moderatorActor||'',VITE_GRAFFITI_MODE:'decentralized'}});if(r.status!==0)throw Error(`Build failed in ${dir}`);}
await rm(out,{recursive:true,force:true});
run('GTGraffitiLauncher/workspace',['node_modules/vite/bin/vite.js','build','--mode','web','--outDir',out,'--emptyOutDir']);
for(const app of ['yudo','sylt']){run(app,['node_modules/vite/bin/vite.js','build','--mode','web',`--base=/apps/${app}/`]);await cp(path.join(root,app,'dist'),path.join(out,'apps',app),{recursive:true});}
run('ourscene',['scripts/run.mjs','build-all']);await cp(path.join(root,'ourscene/dist'),path.join(out,'apps/ourscene'),{recursive:true});
for(const name of ['blue-hour','red-room','lantern','signal-yard'])await rm(path.join(out,'apps/ourscene',name),{recursive:true,force:true});
const encoder=path.join(out,'encoder');await mkdir(encoder,{recursive:true});
const core=path.join(workspace,'node_modules/@ffmpeg/core'),wasm=await readFile(path.join(core,'dist/esm/ffmpeg-core.wasm'));
const hash=createHash('sha256').update(wasm).digest('hex'),compressedPath=`/encoder/ffmpeg-core-0.12.10-${hash.slice(0,12)}.wasm.gz.bin`;
await writeFile(path.join(out,compressedPath),gzipSync(wasm,{level:9}));
const coreJS=await readFile(path.join(core,'dist/esm/ffmpeg-core.js'));const coreJSPath=`/encoder/ffmpeg-core-0.12.10-${createHash('sha256').update(coreJS).digest('hex').slice(0,12)}.js`;await writeFile(path.join(out,coreJSPath),coreJS);
await writeFile(path.join(encoder,'manifest.json'),JSON.stringify({wrapperVersion:'0.12.15',coreVersion:'0.12.10',coreJSPath,sha256:hash,uncompressedBytes:wasm.byteLength,compressedPath},null,2));
await cp(path.join(core,'package.json'),path.join(encoder,'core-package.json'));
await cp(path.join(workspace,'node_modules/@ffmpeg/ffmpeg/package.json'),path.join(encoder,'wrapper-package.json'));
await cp(path.join(root,'licenses'),path.join(out,'licenses'),{recursive:true});
for(const name of ['privacy','agreement']){await mkdir(path.join(out,name),{recursive:true});await cp(path.join(out,`legal/${name}.html`),path.join(out,name,'index.html'));}
const redirects=['/yudo /yudo/ 301','/yudo/ /index.html 200','/sylt /sylt/ 301','/sylt/ /index.html 200','/ourscene /ourscene/ 301','/ourscene/ /index.html 200'];
for(const [old,next]of Object.entries({soundcheck:'yudo',encore:'sylt','music-venues':'ourscene',soundboard:'ourscene'})){redirects.push(`/${old} /${next}/ 302`,`/${old}/ /${next}/ 302`,`/${old}/* /${next}/:splat 302`);}
await writeFile(path.join(out,'_redirects'),redirects.join('\n')+'\n');
await writeFile(path.join(out,'_headers'),`/*\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data: blob:; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' blob: https: wss:; worker-src 'self' blob:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self' https:\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)\n/encoder/ffmpeg-core-*\n  Cache-Control: public, max-age=31536000, immutable\n/encoder/manifest.json\n  Cache-Control: no-cache\n`);
await writeFile(path.join(out,'404.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><title>Page unavailable</title><h1>Page unavailable</h1><p><a href="/">Open GT Graffiti</a></p></html>');
await writeFile(path.join(out,'release.json'),JSON.stringify({version:'1.1.0',profile,builtAt:new Date().toISOString(),encoder:{wrapper:'0.12.15',core:'0.12.10'},preview:profile==='preview'}));
if(!(await readdir(path.join(out,'assets'))).some(name=>/^worker-.*\.js$/.test(name)))throw Error('Missing encoder worker.');
let count=0;async function check(dir){for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory()){await check(file);continue;}count++;const size=(await stat(file)).size;if(size>25*1024*1024)throw Error(`Pages asset exceeds 25 MiB: ${file}`);if(file.endsWith('.js')){const text=await readFile(file,'utf8');if(/\/api\/(session|clips)|127\.0\.0\.1:5178|messageHandlers\??\.gtWorkspace/.test(text))throw Error(`Native dependency in web output: ${file}`);}}}await check(out);if(count>20000)throw Error('Pages Free file-count limit exceeded.');
console.log(`Built ${profile}: ${count} files; compressed encoder ${(gzipSync(wasm).length/1024/1024).toFixed(2)} MiB. No native clip API dependencies.`);
