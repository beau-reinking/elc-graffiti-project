import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {pipeline} from 'node:stream/promises';

const defaultRoot=fileURLToPath(new URL('./dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};

// Serve only built public assets. There is no account gate in front of the app.
export function createAppServer({directory=defaultRoot}={}){
 const root=resolve(directory);
 return createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Cache-Control','no-store');
  const message=(status,text)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?undefined:text)};
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return message(405,'Method not allowed')}
  try{
   // Decode before resolving so encoded separators cannot escape the public directory.
   let pathname;
   try{pathname=decodeURIComponent((req.url||'/').split('?')[0])}catch{return message(400,'Invalid URL')}
   if(!pathname.startsWith('/')||pathname.includes('\0')||pathname.includes('\\'))return message(400,'Invalid URL');
   if(pathname.split('/').some(part=>part==='..'||part.startsWith('.')))return message(404,'Not found');
   const target=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
   if(!target.startsWith(root+sep))return message(404,'Not found');
   const actual=await realpath(target),actualRoot=await realpath(root);
   if(!actual.startsWith(actualRoot+sep))return message(404,'Not found');
   const info=await stat(actual);
   if(!info.isFile())return message(404,'Not found');
   const immutable=/^\/assets\/.+-[a-zA-Z0-9_-]{8,}\.[a-z0-9]+$/.test(pathname);
   res.writeHead(200,{'Content-Type':types[extname(actual)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':immutable?'public, max-age=31536000, immutable':'no-cache'});
   if(req.method==='HEAD')return res.end();
   await pipeline(createReadStream(actual),res);
  }catch(error){
   if(res.headersSent){res.destroy();return}
   if(['ENOENT','ENOTDIR','EACCES'].includes(error.code))return message(404,'Not found');
   console.error('Could not serve a public asset:',error.code||error.message);
   message(500,'Unable to serve this page');
  }
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const host=process.env.HOST||'127.0.0.1';
 const port=Number(process.env.PORT||4173);
 if(!Number.isInteger(port)||port<1||port>65535){console.error('PORT must be an integer from 1 to 65535.');process.exitCode=1}
 else{
  try{await stat(resolve(defaultRoot,'index.html'))}catch{console.error('Build Sylt first with npm run build.');process.exit(1)}
  const server=createAppServer();
  server.on('error',error=>{console.error(`Sylt could not start: ${error.message}`);process.exitCode=1});
  server.listen(port,host,()=>console.log(`Sylt is running at http://${host}:${port}`));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>{process.exitCode=0}));
 }
}
