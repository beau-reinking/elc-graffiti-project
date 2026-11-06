import test from 'node:test';import assert from 'node:assert/strict';import {createRequire}from'node:module';import {readFile}from'node:fs/promises';
import {exportArguments,validateProbe,validateOutput}from'../src/media/contract.js';
const require=createRequire(import.meta.url);
function tone(seconds){const rate=8000,data=new Uint8Array(44+seconds*rate*2),v=new DataView(data.buffer),str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,data.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,data.byteLength-44,true);for(let i=0;i<rate*seconds;i++)v.setInt16(44+i*2,Math.sin(i/rate*2*Math.PI*220)*2000,true);return data;}
test('pinned WASM core probes and exports beginning, middle and end of five-minute audio',async()=>{
 globalThis.self={location:{href:'file:///synthetic-test/ffmpeg-core.js'}};
 const createCore=require('@ffmpeg/core'),core=await createCore({wasmBinary:await readFile(new URL('../node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm',import.meta.url))});
 core.FS.writeFile('input',tone(300));
 const probe=file=>{core.ffprobe('-v','error','-show_format','-show_streams','-of','json',file,'-o','probe.json');const json=JSON.parse(core.FS.readFile('probe.json',{encoding:'utf8'}));core.FS.unlink('probe.json');core.reset();return json;};
 const source=probe('input');assert.equal(Number(source.format.duration),300);validateProbe(source,240,300);
 for(const [start,end]of [[0,30],[120,180],[240,300]]){assert.equal(core.exec(...exportArguments({start,end,video:false,output:'clip.m4a'})),0);core.reset();const output=probe('clip.m4a'),size=core.FS.readFile('clip.m4a').length;validateOutput({duration:Number(output.format.duration),size,mediaType:'audio/mp4'});assert.ok(Math.abs(Number(output.format.duration)-(end-start))<.02);assert.equal(output.streams[0].codec_name,'aac');core.FS.unlink('clip.m4a');}
 core.FS.writeFile('input',new Uint8Array([1,2,3]));core.ffprobe('-v','error','-show_format','-show_streams','-of','json','input','-o','bad.json');let invalid;try{invalid=JSON.parse(core.FS.readFile('bad.json',{encoding:'utf8'}))}catch{invalid={}}assert.throws(()=>validateProbe(invalid,0,1));
});
