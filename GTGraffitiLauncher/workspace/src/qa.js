import {selectClip} from './clip-editor.js';
import {BrowserClipProcessor} from './media/browser.js';
import {SharedIdentity} from './identity.js';
const results=document.querySelector('#results'),processor=new BrowserClipProcessor();let controller,previewUrl;
function clearPreview(){const preview=document.querySelector('#preview');preview.querySelectorAll('audio,video').forEach(el=>{el.pause();el.removeAttribute('src');el.load()});preview.replaceChildren();if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}}
window.addEventListener('pagehide',()=>{processor.dispose();clearPreview()},{once:true});
function log(text){results.textContent+='\n'+text;}
function tone(seconds=8){const rate=8000,data=new ArrayBuffer(44+seconds*rate*2),v=new DataView(data),str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,data.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,data.byteLength-44,true);for(let i=0;i<rate*seconds;i++)v.setInt16(44+i*2,Math.sin(i/rate*2*Math.PI*220)*2000,true);return new Blob([data],{type:'audio/wav'});}
async function frameCheck(){
 let stored;const api={sessionEvents:new EventTarget(),async postMedia(media){if(!(media.data instanceof Blob))throw Error('Parent received foreign Blob');stored=media.data;return 'synthetic:media'},async getMedia(){return {data:stored}}};
 const identity=new SharedIdentity(api);identity.actor='synthetic:test';
 const frame=document.createElement('iframe');frame.title='Synthetic frame realm check';frame.srcdoc='<p>Frame boundary check</p>';document.body.append(frame);await new Promise(resolve=>frame.onload=resolve);
 const client=identity.client({blobConstructor:frame.contentWindow.Blob});await client.postMedia({data:new frame.contentWindow.Blob(['frame audio'],{type:'audio/wav'})},{actor:identity.actor});const output=await client.getMedia('synthetic:media');if(!(output.data instanceof frame.contentWindow.Blob)||await output.data.text()!=='frame audio')throw Error('Frame media conversion failed');client.dispose();frame.remove();log('PASS parent/app frame Blob upload and playback conversion');
}
async function run(source,start,end){clearPreview();controller=new AbortController();const began=performance.now();let last;const output=await processor.prepare(source,{start,end,signal:controller.signal,onProgress:p=>{if(p.stage!==last){last=p.stage;log(p.stage)}}});log(`PASS export ${output.duration}s, ${output.size} bytes, ${output.mediaType}; ${((performance.now()-began)/1000).toFixed(1)}s processing`);const el=document.createElement(output.mediaType.startsWith('video/')?'video':'audio');el.controls=true;previewUrl=URL.createObjectURL(output.blob);el.src=previewUrl;document.querySelector('#preview').replaceChildren(el);}
function action(button,fn){button.onclick=async()=>{document.querySelectorAll('button:not(#cancel)').forEach(b=>b.disabled=true);try{results.textContent='Running';await fn();log('COMPLETE')}catch(e){log(e.name==='AbortError'?'CANCELLED · selection kept; ready to retry':`FAIL ${e.name}: ${e.message}`)}finally{document.querySelectorAll('button').forEach(b=>b.disabled=false);}}}
action(document.querySelector('#audio'),async()=>{await frameCheck();const cancelled=new AbortController();cancelled.abort();try{await processor.prepare(tone(),{start:1,end:4,signal:cancelled.signal});throw Error('Aborted preparation unexpectedly succeeded')}catch(e){if(e.name!=='AbortError')throw e;log('PASS cancellation')}await run(tone(72),5,65);});
action(document.querySelector('#video'),async()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(24),chunks=[];const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const done=new Promise(resolve=>recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'})));recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();const began=performance.now();await new Promise(resolve=>{const draw=()=>{ctx.fillStyle=`hsl(${(performance.now()-began)/10},60%,40%)`;ctx.fillRect(0,0,320,240);ctx.fillStyle='white';ctx.font='30px sans-serif';ctx.fillText('Synthetic clip',30,120);if(performance.now()-began<4000)requestAnimationFrame(draw);else resolve()};draw()});recorder.stop();stream.getTracks().forEach(t=>t.stop());await run(await done,1,3);});
document.querySelector('#cancel').onclick=()=>controller?.abort();

action(document.querySelector('#reference'),async()=>{const source=document.querySelector('#reference-source').files?.[0];if(!source)throw Error('Choose a reference recording first. It stays in this browser.');const start=Number(document.querySelector('#reference-start').value);await run(source,start,start+60);});

// Generated sources exercise formats without accessing a camera or microphone.
action(document.querySelector('#edge-video'),async()=>{
 const canvas=document.createElement('canvas');canvas.width=240;canvas.height=426;
 const ctx=canvas.getContext('2d'),stream=canvas.captureStream(30),track=stream.getVideoTracks()[0],chunks=[];
 const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
 const done=new Promise(resolve=>recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'})));
 recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();
 try{for(let i=0;i<40;i++){ctx.fillStyle=`hsl(${i*9},60%,40%)`;ctx.fillRect(0,0,240,426);ctx.fillStyle='white';ctx.font='20px sans-serif';ctx.fillText(`Portrait ${i}`,20,200);track.requestFrame?.();await new Promise(resolve=>setTimeout(resolve,i%2?140:60));}}
 finally{recorder.stop();stream.getTracks().forEach(t=>t.stop());}
 log('SOURCE portrait 240×426, silent, alternating frame intervals; MediaRecorder WebM');await run(await done,1,3);
 const preview=document.querySelector('#preview video');await new Promise((resolve,reject)=>{if(preview.readyState>=1)return resolve();preview.onloadedmetadata=resolve;preview.onerror=()=>reject(Error('Portrait output metadata unavailable'));});
 if(preview.videoWidth>240||preview.videoHeight>426||preview.videoHeight<=preview.videoWidth)throw Error('Portrait dimensions were not preserved without upscaling');
 log(`PASS portrait orientation/no upscaling: ${preview.videoWidth}×${preview.videoHeight}`);
});
action(document.querySelector('#malformed'),async()=>{
 for(const [start,end]of [[0,61],[2,2],[-1,2]]){try{await processor.prepare(tone(),{start,end,signal:new AbortController().signal});throw Error('Invalid selection unexpectedly succeeded');}catch(e){if(!/selection|interval|seconds|start|end/i.test(e.message))throw e;}}
 log('PASS overlong, empty and negative selections rejected');
 try{await processor.prepare(new Blob(['not a media file'],{type:'video/mp4'}),{start:0,end:1,signal:new AbortController().signal});throw Error('Malformed media unexpectedly succeeded');}catch(e){if(!/could not be read|supported audio or video|Cannot establish this recording/i.test(e.message))throw e;log('PASS malformed media rejected with recoverable error');}
 await run(tone(3),0,2);log('PASS valid retry after malformed media');
});

action(document.querySelector('#editor-lifecycle'),async()=>{
 const host=document.createElement('div'),root=document.createElement('div');host.id='dialogs';root.id='workspace';document.body.append(host,root);
 const source={url:'synthetic:source',value:{title:'Synthetic lifecycle test',duration:5,mediaType:'audio/wav',type:'practice',media:'synthetic:media'}};
 const service={actor:'synthetic:test',session:{actor:'synthetic:test'},async recordings(){return [source]},async source(){return source},api:{async getMedia(){return {data:tone(5)}}},async savedSelection(){return null},async saveSelection(){}};
 const workspace={epoch:0,crosspost:()=>service,processor:{async prepare(blob,{start,end}){const output=tone(end-start);return {blob:output,duration:end-start,size:output.size,exportRevision:'synthetic-lifecycle'}}}};
 const before=sessionStorage.getItem('gt:clip-selection');let pending;
 const until=async check=>{const deadline=performance.now()+5000;while(!check()){if(performance.now()>deadline)throw Error('Editor lifecycle check timed out');await new Promise(resolve=>setTimeout(resolve,20));}};
 try{
  pending=selectClip(workspace,{sourceUrl:source.url});await until(()=>host.querySelector('#prepare-clip'));
  const dialog=host.querySelector('dialog');dialog.querySelector('#prepare-clip').click();await until(()=>dialog.querySelector('#clip-preview'));
  const first=dialog.querySelector('#clip-preview'),firstUrl=first.src;first.muted=true;await first.play();if(dialog.querySelector('#add-clip').disabled)throw Error('Preview did not enable adding');
  const end=dialog.querySelector('#clip-end');end.value='4';end.dispatchEvent(new Event('input'));await until(()=>!dialog.querySelector('#clip-preview'));
  if(!first.paused||first.getAttribute('src'))throw Error('Invalidated preview kept playing or retained its source');
  let revoked=false;try{await fetch(firstUrl)}catch{revoked=true}if(!revoked)throw Error('Invalidated preview URL was not released');log('PASS interval change stops playback and releases prepared media');
  dialog.querySelector('#prepare-clip').click();await until(()=>dialog.querySelector('#clip-preview'));const second=dialog.querySelector('#clip-preview');
  dialog.querySelector('#prepare-clip').click();await until(()=>dialog.querySelector('#clip-preview')&&dialog.querySelector('#clip-preview')!==second);
  second.dispatchEvent(new Event('play'));if(!dialog.querySelector('#add-clip').disabled)throw Error('Stale preview enabled adding a new output');
  const third=dialog.querySelector('#clip-preview');third.muted=true;await third.play();if(dialog.querySelector('#add-clip').disabled)throw Error('Current preview did not enable adding');log('PASS each preparation requires its own current preview');
  dialog.querySelector('[data-cancel]').click();await pending;if(!third.paused||third.getAttribute('src'))throw Error('Closing editor retained playback');log('PASS closing editor stops and releases playback');
 }finally{await workspace.dialogClose?.();await pending?.catch(()=>{});host.remove();root.remove();if(before===null)sessionStorage.removeItem('gt:clip-selection');else sessionStorage.setItem('gt:clip-selection',before);}
});
