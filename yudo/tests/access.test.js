import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Repository} from '../src/repository.js';
import {connections} from '../src/domain.js';
const require=createRequire(import.meta.url),{GraffitiLocal}=require('@graffiti-garden/implementation-local');
const profile={name:'Alice',bio:'Hello',avatar:'',instruments:['Guitar'],genres:['Soul'],inspirations:[],seeking:['band'],openTo:['band'],location:{city:'Brooklyn',lat:40.7,lng:-73.9},samples:[]};
test('real Graffiti access rules isolate drafts, settings, passes, blocks, likes, messages, reports and media',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'soundcheck-test-')),api=new GraffitiLocal({pouchDBOptions:{name:path.join(folder,'db')}});
 const session=actor=>({actor:`did:example:${actor}`}),a=new Repository(api,session('alice'),{moderator:'did:example:mod'}),b=new Repository(api,session('bob')),c=new Repository(api,session('eve'));
 for(const type of ['draft','settings','pass','block']){const o=await a.write(type,{target:'did:example:someone'});await assert.rejects(()=>api.get(o.url,{},b.session));}
 const pub=await a.write('profile',profile);assert.equal((await api.get(pub.url,{})).actor,a.actor);
 const privateMedia=await a.upload(new Blob(['audio'],{type:'audio/wav'}));await assert.rejects(()=>b.media(privateMedia));
 const publicMedia=await a.upload(new Blob(['audio'],{type:'audio/wav'}),true);assert.equal((await api.getMedia(publicMedia,{})).data.size,5);
 const al=await a.write('like',{target:b.actor});assert.equal((await api.get(al.url,{},b.session)).actor,a.actor);await assert.rejects(()=>api.get(al.url,{},c.session));
 assert.equal(connections(a.rows,a.actor).length,0);await b.write('like',{target:a.actor});await a.refresh({full:true});const match=connections(a.rows,a.actor)[0];assert.ok(match);
 const msg=await a.write('message',{target:b.actor,likes:match.likes,text:'Let’s play.'});await assert.rejects(()=>api.get(msg.url,{},c.session));assert.equal((await api.get(msg.url,{},b.session)).value.text,'Let’s play.');
 const report=await a.write('report',{target:b.actor,reason:'Spam',details:'Test'});await assert.rejects(()=>api.get(report.url,{},b.session));assert.equal((await api.get(report.url,{},session('mod'))).value.reason,'Spam');
 await assert.rejects(()=>b.write('exclusion',{target:a.actor}));await assert.rejects(()=>a.write('message',{target:c.actor,likes:match.likes,text:'No match'}));
 await assert.rejects(()=>b.remove(pub.url));assert.deepEqual(await a.removeAll(),[]);await assert.rejects(()=>api.get(pub.url,{}));await assert.rejects(()=>api.getMedia(publicMedia,{}));
});
test('publication makes separate public copies and removes private draft media',async()=>{const folder=await mkdtemp(path.join(os.tmpdir(),'soundcheck-publish-')),api=new GraffitiLocal({pouchDBOptions:{name:path.join(folder,'db')}}),a=new Repository(api,{actor:'did:example:alice'});const privateMedia=await a.upload(new Blob(['take'],{type:'audio/wav'}));const p={...profile,samples:[{media:privateMedia,mediaType:'audio/wav',title:'Take',duration:1}]};await a.replace('draft',p);const published=await a.publish(p,{radius:25},'publish-operation');assert.notEqual(published.value.samples[0].media,privateMedia);await assert.rejects(()=>api.getMedia(privateMedia,{},a.session));assert.equal((await api.getMedia(published.value.samples[0].media,{})).data.size,4);assert.equal(a.rows.filter(o=>o.value.type==='draft').length,0)});
test('continuation cursors process tombstones, expired cursors restart, and retries deduplicate',async()=>{
 let failCursor=false,posts=0;const object={actor:'a',url:'u',value:{app:'urn:soundcheck:musicians:v1',version:1,type:'pass',target:'b',revision:1,operationId:'op'}};
 const api={async *discover(){yield {object};return {cursor:'first'}},async *continueDiscover(){if(failCursor)throw Object.assign(Error('expired cursor'),{name:'GraffitiErrorCursorExpired'});yield {tombstone:true,object};return {cursor:'second'}},async post(o){posts++;return {...o,actor:'a',url:'created'}}};
 const r=new Repository(api,{actor:'a'});await r.refresh();assert.equal(r.rows.length,1);await r.refresh();assert.equal(r.rows.length,0);failCursor=true;await r.refresh();assert.equal(r.rows.length,1);const saved=await r.retryWrite('pass',{target:'b'},'op');assert.equal(saved.url,'u');assert.equal(posts,0);
});
test('partial failures keep removal retryable and do not report success',async()=>{let deny=true;const folder=await mkdtemp(path.join(os.tmpdir(),'soundcheck-remove-')),base=new GraffitiLocal({pouchDBOptions:{name:path.join(folder,'db')}}),api=new Proxy(base,{get(target,key){if(key==='deleteMedia')return async(...args)=>{if(deny)throw Error('offline');return target.deleteMedia(...args)};const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v}}),r=new Repository(api,{actor:'did:example:alice'});await r.upload(new Blob(['take'],{type:'audio/wav'}));assert.equal((await r.removeAll()).length,1);assert.equal(r.rows.filter(o=>o.value.type==='asset').length,1);deny=false;assert.deepEqual(await r.removeAll(),[])});
