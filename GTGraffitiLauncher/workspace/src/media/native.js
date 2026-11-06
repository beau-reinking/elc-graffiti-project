import {validateSource,validateOutput,abortError,TIMEOUT_MS} from './contract.js';
export class NativeClipProcessor{
 constructor({account=()=>''}={}){this.account=account;this.token=null;this.active=null;}
 async request(path,options={}){
  if(!this.token){const r=await fetch('/api/session');if(!r.ok)throw Error('The local media service is unavailable.');this.token=(await r.json()).token;}
  const r=await fetch(path,{...options,headers:{'X-GT-Token':this.token,'X-GT-Account':options.account||this.account()}});
  if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||'The local clip service is unavailable.');
  return options.blob?r.blob():r.json();
 }
 async prepare(source,{start,end,signal,onProgress=()=>{}}){
  validateSource(source,start,end);if(this.active)throw Error('Another clip is being prepared. Cancel it first.');
  const controller=new AbortController(),account=this.account();this.active=controller;let job;
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const timer=setTimeout(abort,TIMEOUT_MS);
  try{
   if(controller.signal.aborted)throw abortError();onProgress({stage:'preparing'});
   const created=await this.request(`/api/clips?start=${start}&end=${end}`,{method:'POST',body:source,signal:controller.signal,account});job=created.id;let status=created;
   while(!['ready','failed','cancelled'].includes(status.status)){
    await new Promise((resolve,reject)=>{const onAbort=()=>{clearTimeout(t);reject(abortError())};const t=setTimeout(()=>{controller.signal.removeEventListener('abort',onAbort);resolve()},350);controller.signal.addEventListener('abort',onAbort,{once:true});if(controller.signal.aborted)onAbort();});
    status=await this.request(`/api/clips/${job}`,{signal:controller.signal,account});onProgress({stage:'preparing',fraction:status.progress});
   }
   if(status.status!=='ready')throw Error(status.error||'Preparation cancelled.');onProgress({stage:'validating'});
   const blob=await this.request(`/api/clips/${job}/result`,{blob:true,signal:controller.signal,account});validateOutput({...status,mediaType:blob.type});
   return {blob,duration:status.duration,size:blob.size,mediaType:blob.type,exportRevision:'native-7.1-v1'};
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(job)await this.request(`/api/clips/${job}`,{method:'DELETE',account}).catch(()=>{});this.active=null;}
 }
 dispose(){this.active?.abort();this.token=null;}
}
