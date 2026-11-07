import {CrosspostService} from '../../GTGraffitiLauncher/workspace/src/crosspost.js';
import {APP,SCHEMA,valid,latest,connections,validateProfile,MAX_BYTES} from './domain.js';
export const ownerChannel=a=>`${APP}:owner:${encodeURIComponent(a)}`;
export const inbox=a=>`${APP}:inbox:${encodeURIComponent(a)}`;
export class Repository {
 constructor(api,session,{moderator=''}={}){this.api=api;this.session=session;this.actor=session.actor;this.moderator=moderator;this.records=new Map();this.cursor=null;this.partial=false;this.warning='';this.revisions=new Map();this.sylt=new CrosspostService(api,session);}
 get rows(){return [...this.records.values()]}
 async refresh({full=false}={}){
  const channels=[`${APP}:profiles`,ownerChannel(this.actor),inbox(this.actor),`${APP}:moderation`];
  let stream=(!full&&this.cursor)?this.api.continueDiscover(this.cursor,this.session):this.api.discover(channels,SCHEMA,this.session);
  const found=new Map();this.partial=false;
  try {while(true){const r=await stream.next();if(r.done){this.cursor=r.value?.cursor??(typeof r.value==='string'?r.value:null);break;}const item=r.value;if(item.error){this.partial=true;continue;}if(item.tombstone){this.records.delete(item.url??item.object?.url);continue;}if(valid(item.object)){found.set(item.object.url,item.object);this.records.set(item.object.url,item.object);}}
  }catch(e){if(this.cursor&&(/cursor/i.test(e.name+' '+e.message))){this.cursor=null;return this.refresh({full:true})}this.partial=true;throw e;}
  if((full||!this.cursor)&&!this.partial)this.records=found;
  if(this.partial)this.cursor=null;
  return this.rows;
 }
 async write(type,data={},operationId=crypto.randomUUID()){
  const existing=this.rows.find(o=>o.actor===this.actor&&o.value.operationId===operationId);if(existing)return existing;
  const revision=Math.max(0,...this.rows.filter(o=>o.actor===this.actor&&o.value.type===type).map(o=>o.value.revision),this.revisions.get(type)||0)+1;this.revisions.set(type,revision);
  const value={...data,app:APP,version:1,type,operationId,revision,createdAt:Date.now()};
  let allowed=[this.actor],channels=[ownerChannel(this.actor)];
  if(type==='profile'){allowed=undefined;channels.push(`${APP}:profiles`)}
  if(['like','message','closure'].includes(type)){if(!data.target||data.target===this.actor)throw Error('Choose another musician.');allowed=[this.actor,data.target];channels.push(inbox(this.actor),inbox(data.target))}
  if(type==='report'){if(!this.moderator)throw Error('Reporting is not configured for this deployment. Contact the app owner.');allowed=[this.actor,this.moderator];channels.push(inbox(this.moderator))}
  if(type==='exclusion'){if(this.actor!==this.moderator)throw Error('Moderator access required.');allowed=undefined;channels.push(`${APP}:moderation`)}
  if(type==='message'){const c=connections(this.rows,this.actor).find(c=>c.actor===data.target&&JSON.stringify([...data.likes].sort())===c.id);if(!c)throw Error('This connection is no longer available.');if(!data.text?.trim()||data.text.length>2000)throw Error('Write a message of 1–2,000 characters.');}
  if(type==='profile')validateProfile(data);
  const object=await this.api.post({value,channels,...(allowed?{allowed}:{})},this.session);this.records.set(object.url,object);return object;
 }
 async retryWrite(type,data,operationId){await this.refresh({full:true});if(this.partial)throw Error('Some sources are unavailable. Reconnect before retrying this save.');return this.write(type,data,operationId)}
 async replace(type,data,operationId){const old=this.rows.filter(o=>o.actor===this.actor&&o.value.type===type);const saved=await this.write(type,data,operationId);const results=await Promise.allSettled(old.filter(o=>o.url!==saved.url).map(o=>this.remove(o.url)));if(results.some(r=>r.status==='rejected'))this.warning='Saved. Some older records could not be removed; retry cleanup in Profile.';return saved;}
 async remove(url){try{await this.api.delete(url,this.session)}catch(e){if(!/NotFound/.test(e.name))throw e;}this.records.delete(url)}
 async upload(blob,isPublic=false){const url=await this.api.postMedia({data:blob,...(!isPublic?{allowed:[this.actor]}:{})},this.session);try{await this.write('asset',{media:url,public:isPublic});}catch(e){await this.api.deleteMedia(url,this.session).catch(()=>{});throw e;}return url;}
 async media(url,types=['audio/*','video/*','image/*']){return (await this.api.getMedia(url,{types,maxBytes:MAX_BYTES},this.session)).data}
 async removeMedia(url){try{await this.api.deleteMedia(url,this.session)}catch(e){if(!/NotFound/.test(e.name))throw e;}for(const o of this.rows.filter(o=>o.actor===this.actor&&o.value.type==='asset'&&o.value.media===url))await this.remove(o.url);}
 async publish(profile,settings,operationId){
  validateProfile(profile);const draft=latest(this.rows,'draft',this.actor);let checkpoint=draft?.value.publish;
  if(!checkpoint||checkpoint.operationId!==operationId){checkpoint={operationId,copies:{}};await this.replace('draft',{...profile,settings,publish:checkpoint});}
  const publicCopy=async url=>{if(!url)return '';if(checkpoint.copies[url])return checkpoint.copies[url];const asset=this.rows.find(o=>o.actor===this.actor&&o.value.type==='asset'&&o.value.media===url);if(asset?.value.public)return url;const out=await this.upload(await this.media(url),true);checkpoint.copies[url]=out;await this.replace('draft',{...profile,settings,publish:checkpoint});return out;};
  const avatar=await publicCopy(profile.avatar);const samples=[];for(const sample of profile.samples||[]){if(sample.syltDraft||sample.sylt)samples.push(await this.sylt.publish(sample));else samples.push({...sample,media:await publicCopy(sample.media)});}
  const previous=latest(this.rows,'profile',this.actor)?.value;
  await this.replace('settings',settings);const p=await this.replace('profile',{...profile,avatar,samples},operationId);
  const keep=new Set([avatar,...samples.map(s=>s.media)]);
  const obsolete=[profile.avatar,...profile.samples.filter(s=>!s.sylt&&!s.syltDraft).map(s=>s.media),previous?.avatar,...(previous?.samples||[]).filter(s=>!s.sylt&&!s.syltDraft).map(s=>s.media)].filter(u=>u&&!keep.has(u));
  const removed=await Promise.allSettled([...new Set(obsolete)].map(u=>this.removeMedia(u)));if(removed.some(r=>r.status==='rejected'))this.warning='Published. Some previous uploads need cleanup in Profile.';
  for(const o of this.rows.filter(o=>o.actor===this.actor&&o.value.type==='draft'))await this.remove(o.url).catch(()=>{this.warning='Published. A private draft still needs cleanup.'});
  return p;
 }
 async removeAll(){await this.refresh({full:true});if(this.partial)throw Error('Some sources are unavailable. Reconnect before removing your app data.');const failures=[];const assets=this.rows.filter(o=>o.actor===this.actor&&o.value.type==='asset');for(const a of assets){try{await this.removeMedia(a.value.media)}catch(e){failures.push(a.value.media)}}for(const o of this.rows.filter(o=>o.actor===this.actor&&o.value.type!=='asset')){try{await this.remove(o.url)}catch(e){failures.push(o.url)}}return failures;}
 async cleanup(){const p=latest(this.rows,'profile',this.actor)?.value,d=latest(this.rows,'draft',this.actor)?.value;const keep=new Set([p?.avatar,d?.avatar,...(p?.samples||[]).map(s=>s.media),...(d?.samples||[]).map(s=>s.media),...Object.values(d?.publish?.copies||{})]);const failures=[];for(const a of this.rows.filter(o=>o.actor===this.actor&&o.value.type==='asset'&&!keep.has(o.value.media)))try{await this.removeMedia(a.value.media)}catch(e){failures.push(a.url)}for(const type of ['profile','settings','draft']){const current=latest(this.rows,type,this.actor);for(const o of this.rows.filter(o=>o.actor===this.actor&&o.value.type===type&&o.url!==current?.url))try{await this.remove(o.url)}catch(e){failures.push(o.url)}}return failures;}
}
