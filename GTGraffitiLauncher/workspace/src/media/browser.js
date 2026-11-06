import {FFmpeg} from '@ffmpeg/ffmpeg';
import {validateSource,validateProbe,validateOutput,exportArguments,OUTPUT_LIMIT,TIMEOUT_MS,abortError} from './contract.js';

async function download(url,signal,onProgress){
 const response=await fetch(url,{signal,cache:'force-cache'});if(!response.ok)throw Error('The clip encoder could not be downloaded. Check your connection and retry.');
 const total=Number(response.headers.get('Content-Length'))||undefined;
 if(!response.body)return new Uint8Array(await response.arrayBuffer());
 const reader=response.body.getReader(),parts=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;parts.push(value);size+=value.byteLength;if(size>25*1024*1024){await reader.cancel();throw Error('The encoder download exceeds the supported limit.');}onProgress({stage:'downloading-encoder',bytes:size,total});}
 const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.byteLength;}return result;
}
async function playbackMetadata(blob,signal){
 return new Promise((resolve,reject)=>{
  const element=document.createElement(blob.type.startsWith('video/')?'video':'audio'),url=URL.createObjectURL(blob);
  const finish=(error)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);element.removeAttribute('src');element.load();URL.revokeObjectURL(url);error?reject(error):resolve();};
  const abort=()=>finish(abortError());const timer=setTimeout(()=>finish(Error('This browser could not open the prepared clip. Try another format.')),15000);
  element.preload='metadata';element.onloadedmetadata=()=>finish(Number.isFinite(element.duration)&&element.duration>0&&element.duration<=60?null:Error('The prepared clip has an unsupported playback duration.'));
  element.onerror=()=>finish(Error('This browser could not play the prepared clip.'));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}element.src=url;
 });
}
export class BrowserClipProcessor{
 constructor(){this.active=null;}
 async prepare(source,{start,end,signal,onProgress=()=>{}}){
  validateSource(source,start,end);if(this.active)throw Error('Another clip is being prepared. Cancel it first.');
  if(!globalThis.WebAssembly||!globalThis.Worker||!globalThis.DecompressionStream)throw Error('This browser cannot prepare clips. Use current desktop Chrome or Firefox.');
  const controller=new AbortController(),ffmpeg=new FFmpeg();let wasmUrl,timedOut=false;
  const abort=()=>{controller.abort();ffmpeg.terminate();};this.active={abort};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const timer=setTimeout(()=>{timedOut=true;abort()},TIMEOUT_MS);const began=performance.now();
  const remaining=()=>Math.max(1,TIMEOUT_MS-(performance.now()-began));
  const check=()=>{if(controller.signal.aborted)throw abortError();};
  try{
   check();onProgress({stage:'loading-encoder'});
   const response=await fetch('/encoder/manifest.json',{signal:controller.signal,cache:'no-cache'});if(!response.ok)throw Error('The encoder manifest is unavailable.');
   const manifest=await response.json();if(manifest.coreVersion!=='0.12.10'||manifest.wrapperVersion!=='0.12.15'||!/^[a-f0-9]{64}$/.test(manifest.sha256)||!/^\/encoder\/[a-zA-Z0-9._-]+$/.test(manifest.compressedPath)||!/^\/encoder\/[a-zA-Z0-9._-]+\.js$/.test(manifest.coreJSPath))throw Error('The encoder manifest is invalid.');
   const compressed=await download(manifest.compressedPath,controller.signal,onProgress);check();
   const bytes=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();check();
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
   if(bytes.byteLength!==manifest.uncompressedBytes||digest!==manifest.sha256)throw Error('Encoder integrity verification failed. Reload the app and retry.');
   wasmUrl=URL.createObjectURL(new Blob([bytes],{type:'application/wasm'}));onProgress({stage:'loading-encoder'});
   await ffmpeg.load({coreURL:new URL(manifest.coreJSPath,location.origin).href,wasmURL:wasmUrl},{signal:controller.signal});check();
   onProgress({stage:'reading-source'});await ffmpeg.writeFile('input',new Uint8Array(await source.arrayBuffer()));check();
   const probe=async(file,name)=>{if(await ffmpeg.ffprobe(['-v','error','-show_format','-show_streams','-of','json',file,'-o',name],remaining())>0)throw Error('This recording could not be read. Choose a supported audio or video file.');const result=JSON.parse(await ffmpeg.readFile(name,'utf8'));await ffmpeg.deleteFile(name);check();return result;};
   const input=await probe('input','source-probe.json');
   if(!Number.isFinite(Number(input.format?.duration))||Number(input.format?.duration)<=0){
    // MediaRecorder WebM commonly omits a duration header. Read actual packet timestamps.
    if(await ffmpeg.ffprobe(['-v','error','-show_packets','-show_entries','packet=pts_time,duration_time','-of','csv=p=0','input','-o','packets.csv'],remaining())>0)throw Error('Cannot determine this recording’s duration.');
    const text=await ffmpeg.readFile('packets.csv','utf8');let first=Infinity,last=-Infinity;
    for(const line of text.split('\n')){if(!line.trim())continue;const [pts,length]=line.split(',').map(Number);if(Number.isFinite(pts)){first=Math.min(first,pts);last=Math.max(last,pts+(Number.isFinite(length)?Math.max(0,length):0));}}
    await ffmpeg.deleteFile('packets.csv');input.format={...input.format,duration:last-first};
   }
   validateProbe(input,start,end);const video=input.streams.some(s=>s.codec_type==='video'),mediaType=video?'video/mp4':'audio/mp4',output=video?'clip.mp4':'clip.m4a';
   ffmpeg.on('progress',({time})=>{if(Number.isFinite(time))onProgress({stage:'preparing',fraction:Math.max(0,Math.min(.99,time/1000000/(end-start)))});});
   let data;
   for(const height of video?[720,480]:[0]){
    check();onProgress({stage:height===480?'retrying-480p':'preparing'});
    const code=await ffmpeg.exec(exportArguments({start,end,video,height,output}),remaining());check();if(code!==0)throw Error('This clip could not be prepared. Try a shorter selection or another recording.');
    data=await ffmpeg.readFile(output);if(data.byteLength<=OUTPUT_LIMIT)break;await ffmpeg.deleteFile(output);data=null;
   }
   if(!data)throw Error('The prepared clip exceeds 50 MiB. Choose a shorter selection.');onProgress({stage:'validating'});
   const result=await probe(output,'result-probe.json'),duration=Number(result.format.duration);
   validateOutput({duration,size:data.byteLength,mediaType});
   const blob=new Blob([data],{type:mediaType});await playbackMetadata(blob,controller.signal);check();
   onProgress({stage:'ready',fraction:1});return {blob,duration,size:blob.size,mediaType,exportRevision:'browser-ffmpeg-core-0.12.10-v1'};
  }catch(error){
   if(timedOut)throw Error('Preparation took more than ten minutes. Your selection is kept; try a shorter interval.');
   if(controller.signal.aborted)throw abortError();
   if(/memory|allocation|out of bounds/i.test(String(error)))throw Error('This browser ran out of memory. Your selection is kept. Close other tabs or try another recording.');
   throw error instanceof Error?error:Error(String(error));
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);ffmpeg.terminate();if(wasmUrl)URL.revokeObjectURL(wasmUrl);this.active=null;}
 }
 dispose(){this.active?.abort();}
}
