import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {createDraft} from '../src/domain.js';
import {Repository} from '../src/repository.js';
const require=createRequire(import.meta.url);
const {ObjectEncoding}=require(path.join(path.dirname(require.resolve('@graffiti-garden/implementation-decentralized')),'3-protocol/3-object-encoding.js'));
function encoder(){return new ObjectEncoding({channelAttestations:{async attest(){return {attestation:new Uint8Array([1]),channelPublicId:new Uint8Array([2])}}},allowedAttestations:{async attest(){return {attestation:new Uint8Array([3]),ticket:new Uint8Array([4])}}},contentAddresses:{async register(){return new Uint8Array([5])}},stringEncoder:{async encode(){return 'test-address'}}});}
test('initial private draft and imported name save through the pinned production encoder before location selection',async()=>{
 const codec=encoder(),writes=[],session={actor:'did:example:acceptance'};
 const repo=new Repository({async post(object,s){writes.push(object);return (await codec.encode(object,s.actor)).object}},session);
 const draft=createDraft();draft.name='Imported Sylt name';draft.instruments=['Drums'];
 const saved=await repo.replace('draft',{...draft,step:0});
 assert.equal(saved.value.name,'Imported Sylt name');assert.deepEqual(saved.value.location,{city:''});assert.deepEqual(writes[0].allowed,[session.actor]);
});
test('legacy unset coordinates normalize without changing selected locations or the original draft',()=>{
 const saved={location:{city:'',lat:null,lng:null},samples:[]};assert.deepEqual(createDraft(saved).location,{city:''});assert.equal(saved.location.lat,null);
 const selected={location:{city:'Atlanta',lat:33.8,lng:-84.4},samples:[]};assert.deepEqual(createDraft(selected),selected);
});
