import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile}from'node:fs/promises';import path from'node:path';import os from'node:os';
import {createWorkspaceServer}from'../server.mjs';import {MediaJobs}from'../media-jobs.mjs';import {NativeClipProcessor}from'../src/media/native.js';
test('native processor adapter still prepares a real clip from the local browser service',async t=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'gt-native-adapter-'));await mkdir(path.join(temp,'dist'));await writeFile(path.join(temp,'dist/index.html'),'workspace');
 const jobs=new MediaJobs({directory:path.join(temp,'jobs')}),server=await createWorkspaceServer({directory:path.join(temp,'dist'),jobs,port:0});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const original=globalThis.fetch,base=`http://127.0.0.1:${server.address().port}`;globalThis.fetch=(url,options={})=>original(new URL(url,base),{...options,headers:{...options.headers,Origin:base}});
 t.after(async()=>{globalThis.fetch=original;await new Promise(resolve=>server.close(resolve));});
 const data=await readFile(new URL('../../../sylt/tests/fixtures/practice.wav',import.meta.url));
 const processor=new NativeClipProcessor({account:()=> 'synthetic-test'}),stages=[];const result=await processor.prepare(new Blob([data],{type:'audio/wav'}),{start:0,end:1,signal:new AbortController().signal,onProgress:p=>stages.push(p.stage)});
 assert.ok(result.blob.size>0);assert.ok(result.duration<=1.1);assert.equal(result.mediaType,'audio/mp4');assert.ok(stages.includes('validating'));processor.dispose();
});
