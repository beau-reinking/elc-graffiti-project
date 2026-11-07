// Blob instanceof checks are realm-specific. Normalize at the shared-client boundary
// in both directions, keeping bytes and MIME type intact.
export async function mediaBlob(data, BlobType=Blob){
 if(data instanceof BlobType)return data;
 const bytes=await Blob.prototype.arrayBuffer.call(data);
 return new BlobType([bytes],{type:data.type});
}
export class SharedIdentity {
 constructor(api,{authentication=()=>{},changed=()=>{},failed=()=>{}}={}){this.failed=failed;this.api=api;this.sessions=new Map();this.actor=sessionStorage.getItem('gt:personal-actor');this.initialized=false;this.events=new EventTarget();this.authentication=authentication;this.changed=changed;
 for(const type of ['login','logout','initialized'])api.sessionEvents.addEventListener(type,e=>{if(type==='login'&&!e.detail.error){this.sessions.set(e.detail.session.actor,e.detail.session);if(!this.actor||this.selecting)this.actor=e.detail.session.actor;this.selecting=false;this.authentication(false)}if(type==='login'&&e.detail.error){this.selecting=false;this.authentication(false);this.failed(e.detail.error)}if(type==='logout'&&!e.detail.error){this.sessions.delete(e.detail.actor);if(this.actor===e.detail.actor)this.actor=this.sessions.keys().next().value;}if(type==='initialized'){this.initialized=true;if(!this.sessions.has(this.actor))this.actor=this.sessions.keys().next().value;}if(this.actor)sessionStorage.setItem('gt:personal-actor',this.actor);else sessionStorage.removeItem('gt:personal-actor');this.events.dispatchEvent(new CustomEvent(type,{detail:e.detail}));this.changed();});}
 get session(){return this.sessions.get(this.actor)}
 login(options){const actor=typeof options==='string'?options:options?.actor;this.selecting=!actor;this.authentication(true);return this.api.login(actor?{actor}:undefined).catch(e=>{this.selecting=false;this.authentication(false);this.failed(e);throw e})}
 async logout(session=this.session){if(session)await this.api.logout(session)}
 select(actor){if(!this.sessions.has(actor))throw Error('Account is unavailable.');this.actor=actor;sessionStorage.setItem('gt:personal-actor',actor);this.events.dispatchEvent(new CustomEvent('accountchange'));this.changed()}
 client({owner=false,personalFirst=false,blobConstructor=Blob}={}){const parent=this,events=new EventTarget(),cleanups=[];let disposed=false,ownerContext=false;const emit=(type,detail)=>events.dispatchEvent(new CustomEvent(type,{detail}));
 const deliver=()=>{if(owner&&!personalFirst){for(const session of parent.sessions.values())emit('login',{session})}else if(parent.session)emit('login',{session:parent.session});emit('initialized',undefined)};
 for(const type of ['login','logout','initialized']){const fn=e=>{if(type==='login'&&(!owner||(personalFirst&&!ownerContext))&&!e.detail.error&&e.detail.session.actor!==parent.actor)return;emit(type,e.detail)};parent.events.addEventListener(type,fn);cleanups.push(()=>parent.events.removeEventListener(type,fn));}
 const change=()=>{ownerContext=false;emit('logout',{actor:adapter.activeActor});adapter.activeActor=parent.actor;if(parent.session)emit('login',{session:parent.session});};parent.events.addEventListener('accountchange',change);cleanups.push(()=>parent.events.removeEventListener('accountchange',change));
 const adapter=new Proxy({sessionEvents:events,activeActor:parent.actor,login:a=>{ownerContext=!!(owner&&a?.actor);return parent.login(owner?a:undefined)},logout:s=>parent.logout(s),
 async postMedia(media,session){
  const actor=parent.actor,data=await mediaBlob(media.data);
  if(disposed||(!owner&&parent.actor!==actor))throw Error('Account changed. Please try again.');
  const result=await parent.api.postMedia({...media,data},session);
  if(disposed||(!owner&&parent.actor!==actor))throw Error('Account changed. Please try again.');
  return result;
 },
 async getMedia(...args){
  const actor=parent.actor,result=await parent.api.getMedia(...args),data=await mediaBlob(result.data,blobConstructor);
  if(disposed||(!owner&&parent.actor!==actor))throw Error('Account changed. Please try again.');
  return {...result,data};
 },
 dispose(){disposed=true;cleanups.forEach(f=>f())}}, {get(target,key){if(key in target)return target[key];const v=parent.api[key];return typeof v==='function'?(...args)=>{if(disposed)throw Error('Account changed. Please try again.');const actor=parent.actor,result=v.apply(parent.api,args);return result?.then?result.then(value=>{if(disposed||parent.actor!==actor)throw Error('Account changed. Please try again.');return value}):result}:v}});setTimeout(deliver,0);return adapter;}
}
