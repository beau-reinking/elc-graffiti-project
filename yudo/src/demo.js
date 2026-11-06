import {APP} from './domain.js';
const db=new Promise((resolve,reject)=>{const r=indexedDB.open('soundcheck-demo-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('objects',{keyPath:'url'});r.result.createObjectStore('media',{keyPath:'url'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
async function tx(store,mode,fn){const d=await db;return new Promise((resolve,reject)=>{const t=d.transaction(store,mode),r=fn(t.objectStore(store));t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error)})}
export class DemoAPI {
 async post(o,s){const row={...o,actor:s.actor,url:`demo:${crypto.randomUUID()}`};await tx('objects','readwrite',x=>x.put(row));return row}
 async *discover(channels,schema,session){for(const o of await tx('objects','readonly',x=>x.getAll()))if(o.channels.some(c=>channels.includes(c))&&(!o.allowed||o.allowed.includes(session?.actor)))yield {object:o};return {cursor:null}}
 async get(url,schema,s){const o=await tx('objects','readonly',x=>x.get(url));if(!o||o.allowed&&!o.allowed.includes(s?.actor))throw Error('Not found');return o}
 async delete(url,s){const o=await this.get(url,{},s);if(o.actor!==s.actor)throw Error('Only the author can delete this.');await tx('objects','readwrite',x=>x.delete(url))}
 async postMedia(o,s){const url=`demo-media:${crypto.randomUUID()}`;await tx('media','readwrite',x=>x.put({...o,actor:s.actor,url}));return url}
 async getMedia(url,accept,s){const o=await tx('media','readonly',x=>x.get(url));if(!o||o.allowed&&!o.allowed.includes(s?.actor))throw Error('Media unavailable');return o}
 async deleteMedia(url,s){const o=await this.getMedia(url,{},s);if(o.actor!==s.actor)throw Error('Only the author can delete this.');await tx('media','readwrite',x=>x.delete(url))}
}
export async function seed(api,Repo){const existing=await tx('objects','readonly',x=>x.getAll());if(existing.some(o=>o.value.app===APP))return;const you='demo:alex';
 const people=[
  [you,'Alex Morgan',['Guitar'],['Indie rock','Soul'],['band'],['band','live'],'Guitar in hand, looking for a rhythm section and a little creative chemistry.',['Khruangbin','Radiohead']],
  ['demo:jules','Jules Rivera',['Drums','Production'],['Indie rock','Soul','Jazz'],['band'],['band','live'],'Pocket over perfection. I love warm grooves, late-night rehearsals, and songs that have room to breathe. Let’s make something that feels like us.',['Khruangbin','Anderson .Paak','BADBADNOTGOOD']],
  ['demo:nia','Nia Brooks',['Vocals','Keys'],['Soul','R&B','Jazz'],['live'],['band','live','session'],'Soulful melodies and unexpected harmonies. Looking for people to build a live set with.',['Hiatus Kaiyote','Erykah Badu']],
  ['demo:leo','Leo Park',['Bass'],['Indie rock','Funk'],['band'],['band','session'],'A good bassline can say everything. Let’s find the groove.',['Khruangbin','Vulfpeck']],
  ['demo:sam','Sam Ellis',['Keys','Production'],['Electronic','Jazz'],['session'],['session','live'],'Analog textures, jazz chords, and a little bit of beautiful noise.',['Floating Points','Radiohead']],
  ['demo:imani','Imani Davis',['Saxophone'],['Jazz','Soul'],['live'],['live','session'],'Making room for improvisation. Always up for a thoughtful session.',['Nubya Garcia','John Coltrane']]
 ];
 for(const [actor,name,instruments,genres,seeking,openTo,bio,inspirations]of people){const r=new Repo(api,{actor},{moderator:'demo:moderator'});await r.write('profile',{name,instruments,genres,seeking,openTo,bio,inspirations,location:{city:'Brooklyn, NY',lat:40.7,lng:-73.9},samples:[],avatar:'',statement:'Open to something good.'});if(actor===you)await r.write('settings',{radius:25,instruments:[],genres:[],intent:'',notifications:true});}
 const jules=new Repo(api,{actor:'demo:jules'});await jules.write('like',{target:you});const nia=new Repo(api,{actor:'demo:nia'}),mine=new Repo(api,{actor:you});const a=await nia.write('like',{target:you}),b=await mine.write('like',{target:'demo:nia'});await nia.write('message',{target:you,likes:[a.url,b.url].sort(),text:'Hey Alex! Love that you’re into soul too. What have you been playing lately?'}).catch(async()=>{await nia.refresh();await nia.write('message',{target:you,likes:[a.url,b.url].sort(),text:'Hey Alex! Love that you’re into soul too. What have you been playing lately?'})});
}
