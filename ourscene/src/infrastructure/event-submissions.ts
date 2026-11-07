import {mode} from './client';
import type {Graffiti, GraffitiSession} from '@graffiti-garden/api';
import {MusicEvent, type EventInput} from '../domain/events';
import {VenueProfile, GeoPoint, text, object} from '../domain/models';
import type {EventFeedItem} from '../application/ports';
export const submissionChannel='music-venues:v1:event-submissions';
export const approvalChannel='music-venues:v1:approved-community-events';
export const reviewer=mode==='local'?'did:example:gt-demo':import.meta.env.VITE_MODERATOR_ACTOR?.trim()||'';
type Raw={url:string;actor:string;allowed?:readonly string[]|null;value:Record<string,unknown>};
export interface Submission {url:string;actor:string;operationId:string;event:EventInput;venue:{name:string;address:string;location?:{latitude:number;longitude:number}}}
interface Decision {url:string;key:string;status:'approved'|'rejected'|'withdrawn';revision:number;published:number;event?:EventFeedItem}
export const submissionKey=(s:Submission)=>JSON.stringify([s.actor,s.operationId]);
export function parseSubmission(row:Raw,moderator:string):Submission{
 const v=row.value;if(v.type!=='EventSubmission'||v.schemaVersion!==1||!row.allowed?.includes(moderator)||row.allowed.some(a=>a!==row.actor&&a!==moderator))throw Error('Invalid restricted event submission.');
 const venue=object(v.venue),event=MusicEvent.draft(object(v.event) as unknown as EventInput,moderator,'submission',1,Date.now());
 return {url:row.url,actor:row.actor,operationId:text(v.operationId,'Operation ID',200),event,venue:{name:text(venue.name,'Venue name',120),address:text(venue.address,'Venue address',300),...(venue.location?{location:new GeoPoint(object(venue.location) as unknown as {latitude:number;longitude:number})}:{})}};
}
export function parseDecision(row:Raw,moderator:string,publicOnly=false):Decision{
 const v=row.value;if(row.actor!==moderator||v.type!=='EventDecision'||v.schemaVersion!==1||!['approved','rejected','withdrawn'].includes(String(v.status))||!Number.isSafeInteger(v.revision)||(v.revision as number)<1||!Number.isSafeInteger(v.published))throw Error('Untrusted event decision.');
 if(publicOnly&&row.allowed!=null)throw Error('Restricted decision is not public.');
 const result:Decision={url:row.url,key:text(v.key,'Submission key',4096),status:v.status as Decision['status'],revision:v.revision as number,published:v.published as number};
 if(v.status==='approved'){
  if(row.allowed!=null)throw Error('Approved event must be public.');const venue=object(v.venue),event=new MusicEvent(row,v.event);
  if(event.venueActor!==moderator||event.value.demoArtworkKey||event.value.tickets?.demo)throw Error('Invalid approved event.');
  const profile=new VenueProfile(row,{type:'VenueProfile',schemaVersion:1,published:v.published,name:`Community: ${text(venue.name,'Venue name',100)}`,address:text(venue.address,'Address',300),...(venue.location?{location:venue.location}:{})});
  result.event={event,venue:profile};
 }
 return result;
}
export function approvedItems(rows:Raw[],moderator:string):EventFeedItem[]{
 const latest=new Map<string,Decision>(),removed=new Set<string>();for(const row of rows){try{const d=parseDecision(row,moderator,true);if(d.status==='withdrawn')removed.add(d.key);const old=latest.get(d.key);if(!old||d.revision>old.revision||(d.revision===old.revision&&(d.published>old.published||(d.published===old.published&&d.url>old.url))))latest.set(d.key,d);}catch{/* Reject forged and malformed decisions. */}}
 return [...latest.values()].filter(d=>d.status==='approved'&&!removed.has(d.key)).flatMap(d=>d.event?[d.event]:[]);
}
export class EventSubmissions{
 private caches=new Map<string,{rows:Map<string,Raw>;cursor?:string}>();private generation=0;private pending=new Map<string,Promise<Raw[]>>();
 constructor(private api:Graffiti,readonly moderator:string){}
 dispose(){this.generation++;this.caches.clear();this.pending.clear();}
 async list(channel:string,session?:GraffitiSession):Promise<Raw[]>{
  const key=JSON.stringify([channel,session?.actor]),existing=this.pending.get(key);if(existing)return existing;
  const promise=this.synchronize(channel,session).finally(()=>{if(this.pending.get(key)===promise)this.pending.delete(key)});this.pending.set(key,promise);return promise;
 }
 private async synchronize(channel:string,session?:GraffitiSession,retry=true):Promise<Raw[]>{
  const generation=this.generation,key=JSON.stringify([channel,session?.actor]),cache=this.caches.get(key)||{rows:new Map<string,Raw>(),cursor:undefined};
  const rows=new Map(cache.rows);
  try{
   const stream=cache.cursor?this.api.continueDiscover(cache.cursor):this.api.discover([channel],{},session);
   while(true){const step=await stream.next();if(generation!==this.generation)throw Error('Account changed.');if(step.done){this.caches.set(key,{rows,cursor:step.value.cursor});break;}const value=step.value;if(value.error)throw Error('Event data is temporarily unavailable. Retry.');if(value.tombstone)rows.delete(value.object.url);else rows.set(value.object.url,value.object as unknown as Raw);}
   return [...rows.values()];
  }catch(error){if(generation!==this.generation)throw error;this.caches.delete(key);if(cache.cursor&&retry)return this.synchronize(channel,session,false);throw error;}
 }
 async submit(input:Omit<Submission,'url'|'actor'>,session:GraffitiSession){
  if(!this.moderator)throw Error('Event review is not configured.');
  const value={type:'EventSubmission',schemaVersion:1,operationId:input.operationId,event:input.event,venue:input.venue};parseSubmission({url:'draft:submission',actor:session.actor,allowed:[session.actor,this.moderator],value},this.moderator);
  if(input.event.startsAt<=Date.now())throw Error('Choose an upcoming event.');
  const old=(await this.list(submissionChannel,session)).find(r=>r.actor===session.actor&&r.value.type==='EventSubmission'&&r.value.operationId===input.operationId);if(old)return old;
  return this.api.post({value,channels:[submissionChannel],allowed:[...new Set([session.actor,this.moderator])]},session);
 }
 async decide(submission:Submission,status:'approved'|'rejected'|'withdrawn',session:GraffitiSession){
  const generation=this.generation;
  if(session.actor!==this.moderator)throw Error('Only the configured project reviewer may decide.');
  const fresh=await this.api.get(submission.url,{},session);const s=parseSubmission(fresh as unknown as Raw,this.moderator);if(s.actor!==submission.actor||s.operationId!==submission.operationId)throw Error('Submission changed. Refresh.');
  const key=submissionKey(s),rows=[...await this.list(approvalChannel),...await this.list(submissionChannel,session)],decisions=rows.flatMap(row=>{try{return [parseDecision(row,this.moderator)]}catch{return []}}).filter(d=>d.key===key);
  if(decisions.some(d=>d.status==='withdrawn'))throw Error('This event was withdrawn. A new submission is required.');
  if(decisions.some(d=>d.status===status))return;
  const revision=Math.max(0,...decisions.map(d=>d.revision))+1,published=Date.now();
  const value={type:'EventDecision',schemaVersion:1,key,status,revision,published,...(status==='approved'?{event:MusicEvent.draft(s.event,this.moderator,crypto.randomUUID(),1,published),venue:s.venue}:{})};
  if(status==='approved'&&s.event.startsAt<=Date.now())throw Error('This event is no longer upcoming.');
  if(generation!==this.generation)throw Error('Account changed.');
  const publicRecord=status!=='rejected';
  const posted=await this.api.post({value,channels:[publicRecord?approvalChannel:submissionChannel],...(publicRecord?{}:{allowed:[...new Set([s.actor,this.moderator])]})},session);
  if(generation!==this.generation)throw Error('Account changed.');
  const cacheKey=JSON.stringify([publicRecord?approvalChannel:submissionChannel,publicRecord?undefined:session.actor]);
  await this.pending.get(cacheKey)?.catch(()=>{});if(generation!==this.generation)throw Error('Account changed.');
  const cache=this.caches.get(cacheKey);if(cache)cache.rows.set(posted.url,posted as unknown as Raw);
  return posted;
 }
}
