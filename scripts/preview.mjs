import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function createStaticServer(directory){const headerFile=readFile(path.join(directory,'_headers'),'utf8').catch(()=>'');return http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const url=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(url.pathname);
  const alias={soundcheck:'yudo',encore:'sylt','music-venues':'ourscene',soundboard:'ourscene'}[pathname.split('/')[1]];
  if(alias){res.writeHead(302,{Location:`/${alias}/${url.search}`});res.end();return;}
  if(/^\/(yudo|sylt|ourscene)\/?$/.test(pathname))pathname='/index.html';
  const file=path.resolve(directory,'.'+pathname);if(!file.startsWith(path.resolve(directory)+path.sep)&&file!==path.resolve(directory))throw Error('Invalid path');
  let target=file;if((await stat(file)).isDirectory())target=path.join(file,'index.html');
  const data=await readFile(target),ext=path.extname(target);
  let matches=false;const headers={};for(const line of (await headerFile).split('\n')){if(line.startsWith('/')){const expression='^'+line.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replaceAll('*','.*')+'$';matches=new RegExp(expression).test(url.pathname);}else if(matches&&/^\s+[^:]+:/.test(line)){const at=line.indexOf(':');headers[line.slice(0,at).trim()]=line.slice(at+1).trim();}}
  const type={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.bin':'application/octet-stream','.ttf':'font/ttf','.woff2':'font/woff2'}[ext]||'application/octet-stream';
  res.writeHead(200,{...headers,'Content-Type':type,'X-Content-Type-Options':'nosniff','Permissions-Policy':'camera=(self), microphone=(self), geolocation=(self)'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
 });}
if(process.argv[1]===fileURLToPath(import.meta.url)){const root=fileURLToPath(new URL('../dist-web',import.meta.url));const server=createStaticServer(root);server.on('error',error=>{console.error(`Could not open preview: ${error.message}. No existing server was stopped.`);process.exitCode=1});server.listen(5189,'127.0.0.1',()=>console.log('Static web preview: http://127.0.0.1:5189 (no native APIs)'));}
