import {GraffitiDecentralized} from '@graffiti-garden/implementation-decentralized';
const api=new GraffitiDecentralized(),q=id=>document.querySelector(`#${id}`);let session,generation=0;
api.sessionEvents.addEventListener('login',event=>{generation++;session=event.detail.session;if(event.detail.error){session=undefined;q('session').textContent='Sign-in failed; retry.';}else q('session').textContent='Signed in. Verify the expected test handle before running checks.';});
api.sessionEvents.addEventListener('logout',()=>{generation++;session=undefined;q('session').textContent='Signed out.';q('manifest').value='';});
api.sessionEvents.addEventListener('initialized',()=>{if(!session)q('session').textContent='Sign in with a designated acceptance identity.';});
q('login').onclick=()=>api.login().catch(()=>{q('results').textContent='Sign-in did not complete; retry.';});
async function current(){const selected=session,epoch=generation,handle=q('handle').value.trim();if(!selected||!handle)throw Error('Sign in and enter the expected dedicated test handle.');if(await api.handleToActor(handle)!==selected.actor)throw Error('The selected account does not match the expected test handle.');return {session:selected,check(){if(generation!==epoch||session!==selected)throw Error('Account changed; run the check again.');}};}
function action(id,fn){q(id).onclick=async()=>{document.querySelectorAll('button').forEach(b=>b.disabled=true);q('results').textContent='Running…';try{const context=await current();await fn(context);context.check();}catch(error){q('results').textContent=`INCOMPLETE · ${error.name==='GraffitiErrorNotFound'?'A required reference is unavailable; reconcile as owner before retrying.':/Account changed|test handle|Sign in|reference list/.test(error.message)?error.message:'The check could not complete. Retry after checking connectivity.'}`;}finally{document.querySelectorAll('button').forEach(b=>b.disabled=false);}};}
const SYLT='encore.music.v1',YUDO='urn:soundcheck:musicians:v1';
const schema={type:'object',properties:{value:{type:'object',properties:{app:{enum:[SYLT,YUDO]}},required:['app']}},required:['value']};
function parse(){let value;try{value=JSON.parse(q('manifest').value);}catch{throw Error('Load a valid private acceptance reference list.');}if(value.version!==1||typeof value.actor!=='string'||!Array.isArray(value.entries)||value.entries.length>300||!value.entries.length)throw Error('Invalid acceptance reference list.');for(const item of value.entries)if(!['object','media'].includes(item.kind)||typeof item.url!=='string'||!item.url.startsWith('graffiti:')||typeof item.public!=='boolean'||typeof item.type!=='string'||!(item.allowed==null||Array.isArray(item.allowed)&&item.allowed.every(a=>typeof a==='string')))throw Error('Invalid acceptance reference list.');return value;}
async function read(item,context){context.check();const result=item.kind==='media'?await api.getMedia(item.url,{types:['audio/*','video/*','image/*'],maxBytes:100*1024*1024},context.session):await api.get(item.url,{},context.session);context.check();return result;}
action('capture',async context=>{
 const actor=context.session.actor,rows=new Map(),channels=[SYLT,`${SYLT}:${actor}`,`${YUDO}:profiles`,`${YUDO}:owner:${encodeURIComponent(actor)}`,`${YUDO}:inbox:${encodeURIComponent(actor)}`];
 for await(const item of api.discover(channels,schema,context.session)){context.check();if(item.error)throw item.error;if(item.tombstone)rows.delete(item.object?.url);else if(item.object?.actor===actor)rows.set(item.object.url,item.object);}
 const entries=[],media=new Map();
 for(const object of rows.values()){
  const type=String(object.value.type||'unknown');entries.push({kind:'object',url:object.url,type,public:object.allowed==null,allowed:object.allowed||null});
  for(const url of [object.value.media,object.value.avatar,...(object.value.samples||[]).map(s=>s.media)].filter(url=>typeof url==='string'&&url.startsWith('graffiti:')))if(!media.has(url)){
   const result=await api.getMedia(url,{types:['audio/*','video/*','image/*'],maxBytes:100*1024*1024},context.session);context.check();if(result.actor!==actor)throw Error('Media ownership did not match.');media.set(url,{kind:'media',url,type:`${type}-media`,public:result.allowed==null,allowed:result.allowed||null});
  }
 }
 entries.push(...media.values());if(!entries.length)throw Error('No authored acceptance references were found.');
 q('manifest').value=JSON.stringify({version:1,actor,capturedAt:Date.now(),entries});q('results').textContent=`CAPTURED ${entries.length} references. No record contents or credentials included. Verify as owner, then check with a different account.`;
});
action('owner',async context=>{const manifest=parse();if(manifest.actor!==context.session.actor)throw Error('The reference list belongs to another test account.');let count=0;for(const item of manifest.entries){const result=await read(item,context);if(result.actor!==manifest.actor||((result.allowed==null)!==item.public))throw Error('Reference ownership or permissions changed.');count++;}q('results').textContent=`PASS owner can still read all ${count} references. Recheck after isolation to rule out deletion.`;});
action('isolation',async context=>{
 const manifest=parse();if(manifest.actor===context.session.actor)throw Error('Use a different test account from the reference list owner.');
 const counts={public:0,denied:0,participant:0},types=new Map();
 for(const item of manifest.entries){
  if(!item.public&&item.allowed?.includes(context.session.actor)){counts.participant++;continue;}
  try{const result=await read(item,context);if(!item.public){q('results').textContent=`FAIL restricted ${item.kind} was readable by an unrelated account. Stop release testing and investigate.`;return;}if(result.actor!==manifest.actor)throw Error('Public reference author changed.');counts.public++;}
  catch(error){context.check();if(!item.public&&['GraffitiErrorForbidden','GraffitiErrorNotFound'].includes(error.name)){counts.denied++;types.set(item.type,(types.get(item.type)||0)+1);}else throw error;}
 }
 q('results').textContent=`PASS ${counts.public} public references readable; ${counts.denied} restricted references denied; ${counts.participant} permitted-participant references skipped.\nDenied types: ${[...types].map(([type,n])=>`${type}: ${n}`).join(', ')}\nOwner must recheck these same references to rule out deletion. This result covers only the listed references.`;
});
