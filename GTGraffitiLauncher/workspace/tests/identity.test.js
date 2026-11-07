import test from 'node:test';
import assert from 'node:assert/strict';
import {SharedIdentity} from '../src/identity.js';
function fixture(){const values=new Map();globalThis.sessionStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};const api={sessionEvents:new EventTarget(),async login(options){this.sessionEvents.dispatchEvent(new CustomEvent('login',{detail:{session:{actor:options?.actor||'personal'}}}))},async logout(s){this.sessionEvents.dispatchEvent(new CustomEvent('logout',{detail:{actor:s.actor}}))}};return new SharedIdentity(api)}
test('owner authentication does not replace the personal actor shared by Yudo and Sylt',async()=>{const shared=fixture();await shared.login();const personal=shared.client(),owner=shared.client({owner:true}),received=[];personal.sessionEvents.addEventListener('login',e=>received.push(e.detail.session.actor));await owner.login({actor:'venue-owner'});assert.equal(shared.actor,'personal');assert.ok(shared.sessions.has('venue-owner'));assert.deepEqual(received,[]);personal.dispose();owner.dispose();});
test('switching personal actors emits logout before the new session and disposed views stop receiving events',async()=>{const shared=fixture();await shared.login();await shared.login({actor:'other'});const client=shared.client(),seen=[];client.sessionEvents.addEventListener('logout',e=>seen.push(['logout',e.detail.actor]));client.sessionEvents.addEventListener('login',e=>seen.push(['login',e.detail.session.actor]));shared.select('other');assert.deepEqual(seen,[['logout','personal'],['login','other']]);client.dispose();shared.select('personal');assert.equal(seen.length,2)});

test('login-event failures surface to the workspace and permit retry',async()=>{
 fixture();const failures=[],authentication=[],api={sessionEvents:new EventTarget(),async login(){}};
 const shared=new SharedIdentity(api,{failed:e=>failures.push(e.message),authentication:enabled=>authentication.push(enabled)});
 await shared.login();api.sessionEvents.dispatchEvent(new CustomEvent('login',{detail:{error:new Error('Passkey cancelled')}}));
 assert.deepEqual(failures,['Passkey cancelled']);assert.equal(shared.selecting,false);assert.equal(shared.session,undefined);
 await shared.login();api.sessionEvents.dispatchEvent(new CustomEvent('login',{detail:{session:{actor:'retried'}}}));
 assert.equal(shared.actor,'retried');assert.deepEqual(authentication,[true,false,true,false]);
});
test('rejected login promises also report a recoverable failure',async()=>{
 fixture();const failures=[],api={sessionEvents:new EventTarget(),async login(){throw Error('Provider unavailable')}};
 const shared=new SharedIdentity(api,{failed:e=>failures.push(e.message)});
 await assert.rejects(shared.login(),/Provider unavailable/);assert.deepEqual(failures,['Provider unavailable']);assert.equal(shared.selecting,false);
});
test('restored sessions arrive through events without starting authentication',()=>{
 fixture();const authentication=[],api={sessionEvents:new EventTarget()};
 const shared=new SharedIdentity(api,{authentication:enabled=>authentication.push(enabled)});
 api.sessionEvents.dispatchEvent(new CustomEvent('login',{detail:{session:{actor:'restored'}}}));api.sessionEvents.dispatchEvent(new CustomEvent('initialized'));
 assert.equal(shared.actor,'restored');assert.equal(shared.initialized,true);assert.deepEqual(authentication,[false]);
});

test('shared media uploads normalize foreign-realm Blobs without changing bytes, type, or audience',async()=>{
 fixture();let received;
 const api={sessionEvents:new EventTarget(),async postMedia(media){assert.ok(media.data instanceof Blob);received=media;return 'media:saved'}};
 const shared=new SharedIdentity(api),client=shared.client();
 const foreign=new Blob(['recorded audio'],{type:'audio/webm'}),type=foreign.type;
 Object.defineProperty(foreign,'type',{value:type});Object.setPrototypeOf(foreign,null);
 assert.equal(foreign instanceof Blob,false);
 assert.equal(await client.postMedia({data:foreign,allowed:['personal']},{actor:'personal'}),'media:saved');
 assert.equal(await received.data.text(),'recorded audio');assert.equal(received.data.type,'audio/webm');assert.deepEqual(received.allowed,['personal']);client.dispose();
});
test('media reads return a Blob in the requesting app realm for playback and sharing',async()=>{
 fixture();class AppBlob extends Blob{}
 const api={sessionEvents:new EventTarget(),async getMedia(){return {data:new Blob(['take'],{type:'audio/wav'}),actor:'personal',allowed:['personal']}}};
 const client=new SharedIdentity(api).client({blobConstructor:AppBlob});const result=await client.getMedia('media:saved');
 assert.ok(result.data instanceof AppBlob);assert.equal(await result.data.text(),'take');assert.equal(result.data.type,'audio/wav');assert.deepEqual(result.allowed,['personal']);client.dispose();
});
test('non-Blob input is rejected and disposed clients cannot upload a prepared recording',async()=>{
 fixture();let called=false;const api={sessionEvents:new EventTarget(),async postMedia(){called=true}};
 const client=new SharedIdentity(api).client();await assert.rejects(client.postMedia({data:{type:'audio/wav',arrayBuffer:async()=>new ArrayBuffer(1)}}));
 client.dispose();await assert.rejects(client.postMedia({data:new Blob(['take'])}),/Account changed/);assert.equal(called,false);
});

test('an upload finishing after an app is disposed cannot continue into a stale save',async()=>{
 fixture();let finish,started;
 const began=new Promise(resolve=>started=resolve);
 const api={sessionEvents:new EventTarget(),postMedia(){started();return new Promise(resolve=>finish=resolve)}};
 const client=new SharedIdentity(api).client();const result=client.postMedia({data:new Blob(['take'])});
 await began;client.dispose();finish('media:old-account');await assert.rejects(result,/Account changed/);
});


test('OurScene restores only the selected personal actor until explicit owner login',async()=>{
 const shared=fixture();await shared.login();await shared.login({actor:'venue-owner'});
 const client=shared.client({owner:true,personalFirst:true}),seen=[];client.sessionEvents.addEventListener('login',e=>seen.push(e.detail.session.actor));
 await new Promise(resolve=>setTimeout(resolve,5));assert.deepEqual(seen,['personal']);
 await client.login({actor:'venue-owner'});assert.deepEqual(seen,['personal','venue-owner']);assert.equal(shared.actor,'personal');
 shared.select('venue-owner');shared.select('personal');assert.equal(seen.at(-1),'personal');client.dispose();
});
