import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {GraffitiRepository} from '../src/repository.js';

// Exercise the pinned production encoder, not just the more permissive local backend.
const require=createRequire(import.meta.url);
const {ObjectEncoding}=require(path.join(path.dirname(require.resolve('@graffiti-garden/implementation-decentralized')),'3-protocol/3-object-encoding.js'));
function fixture(){
 const encoder=new ObjectEncoding({
  channelAttestations:{async attest(){return {attestation:new Uint8Array([1]),channelPublicId:new Uint8Array([2])}}},
  allowedAttestations:{async attest(){return {attestation:new Uint8Array([3]),ticket:new Uint8Array([4])}}},
  contentAddresses:{async register(){return new Uint8Array([5])}},
  stringEncoder:{async encode(){return 'test-content-address'}}
 });
 const writes=[],api={
  async post(object,session){writes.push(object);return (await encoder.encode(object,session.actor)).object},
  async postMedia(media,session){writes.push(media);const object={value:{mediaType:media.data.type},channels:[],...('allowed' in media?{allowed:media.allowed}:{})};return (await encoder.encode(object,session.actor)).object.url}
 };
 return {repo:new GraffitiRepository({actor:'did:example:alice'},api),writes,encoder};
}
test('production encoder reproduces the null access-list failure',async()=>{
 const {encoder}=fixture();await assert.rejects(encoder.encode({value:{name:'Alice'},channels:[],allowed:null},'did:example:alice'),TypeError);
});
test('first Sylt profile publishes without a null access list',async()=>{
 const {repo,writes}=fixture();const profile=await repo.post('profile',{name:'Alice',instrument:'Guitar',interests:'Jazz',avatar:''},null);
 assert.equal(profile.value.name,'Alice');assert.equal(Object.hasOwn(writes[0],'allowed'),false);assert.equal(Object.hasOwn(profile,'allowed'),false);
});
test('public recording metadata and media omit access lists; private defaults stay restricted',async()=>{
 const {repo,writes}=fixture(),blob=new Blob(['audio'],{type:'audio/wav'});
 await repo.upload(blob,null);await repo.post('public',{title:'Take',media:'graffiti:test',mediaType:'audio/wav',duration:1},null);
 assert.equal(Object.hasOwn(writes[0],'allowed'),false);assert.equal(Object.hasOwn(writes[1],'allowed'),false);
 await repo.upload(blob);await repo.post('settings',{blocked:[],hidden:[]});
 assert.deepEqual(writes[2].allowed,['did:example:alice']);assert.deepEqual(writes[3].allowed,['did:example:alice']);
});
