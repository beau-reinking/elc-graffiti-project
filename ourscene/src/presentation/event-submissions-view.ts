import type {Graffiti} from '@graffiti-garden/api';
import type {EventFeedItem} from '../application/ports';
import {GraffitiIdentityAdapter} from '../infrastructure/identity';
import {EventSubmissions,reviewer,submissionChannel,approvalChannel,parseSubmission,approvedItems,parseDecision,submissionKey} from '../infrastructure/event-submissions';
import {localToInstant} from '../domain/schedule';
import {node,safeError} from './dom';
export function mountEventSubmissions(root:HTMLElement,client:Graffiti,update:(items:EventFeedItem[])=>void){
 const identity=new GraffitiIdentityAdapter(client),service=new EventSubmissions(client,reviewer);let disposed=false,epoch=0,refreshId=0,signature='',busy=false,operationId=crypto.randomUUID();
 root.innerHTML='<h2>Share an upcoming event</h2><p>Anyone signed in can submit. The project reviewer must approve an event before it appears publicly. Approval does not verify venue ownership or guarantee accuracy.</p><div data-account></div><form data-submission><label>Event title<input name="title" maxlength="140" required></label><label>Description<textarea name="description" maxlength="8000" required></textarea></label><label>Venue name<input name="venue" maxlength="100" required></label><label>Venue address<input name="address" maxlength="300" required></label><label>Timezone<input name="zone" value="America/New_York" required></label><label>Starts (venue local time)<input name="start" type="datetime-local" required></label><label>Ends (venue local time)<input name="end" type="datetime-local" required></label><label>Latitude (optional)<input name="latitude" type="number" min="-90" max="90" step="any"></label><label>Longitude (optional)<input name="longitude" type="number" min="-180" max="180" step="any"></label><label>Event or ticket link (HTTPS, optional)<input name="link" type="url"></label><label><input name="consent" type="checkbox" required> I may share these details. I understand the event details and my Graffiti submission identity may become public after approval.</label><button type="submit">Submit for review</button></form><p data-status role="status"></p><button data-refresh>Refresh submissions</button><div data-inbox></div>';
 const status=root.querySelector<HTMLElement>('[data-status]')!,form=root.querySelector<HTMLFormElement>('form')!;
 const report=(error:unknown)=>{status.textContent=safeError(error);};
 async function refresh(){const current=epoch,id=++refreshId;try{
  const publicRows=await service.list(approvalChannel);if(disposed||current!==epoch||id!==refreshId)return;update(approvedItems(publicRows,reviewer));
  const session=identity.currentSession(),inbox=root.querySelector<HTMLElement>('[data-inbox]')!;if(!session){inbox.replaceChildren();return;}
  const rows=await service.list(submissionChannel,session);if(disposed||current!==epoch||id!==refreshId)return;
  inbox.replaceChildren();inbox.append(node('h3','',session.actor===reviewer?'Event review inbox':'Your submissions'));
  const decisions=[...publicRows,...rows].flatMap(row=>{try{return [parseDecision(row,reviewer)]}catch{return []}});
  for(const row of rows){let s;try{s=parseSubmission(row,reviewer)}catch{continue;}if(session.actor!==reviewer&&s.actor!==session.actor)continue;
   const decision=decisions.filter(d=>d.key===submissionKey(s)).sort((a,b)=>b.revision-a.revision||b.published-a.published||b.url.localeCompare(a.url))[0];
   const card=node('article','submission-card');card.append(node('h4','',s.event.title),node('p','',`${s.venue.name} · ${s.venue.address}`),node('p','',`${new Date(s.event.startsAt).toLocaleString('en',{timeZone:s.event.timeZone})} (${s.event.timeZone})`),node('p','',s.event.description),node('strong','',decision?.status||'Pending review'));
   if(session.actor===reviewer&&decision?.status!=='withdrawn')for(const action of (decision?.status==='approved'?['withdrawn']:['approved','rejected']) as ('approved'|'rejected'|'withdrawn')[]){const button=node('button','',action==='approved'?'Approve and publish':action==='withdrawn'?'Withdraw public event':'Reject');button.onclick=async()=>{button.disabled=true;try{await service.decide(s,action,session);if(current!==epoch)return;status.textContent='Decision saved.';await refresh()}catch(e){report(e)}finally{button.disabled=false}};card.append(button);}
   inbox.append(card);
  }
 }catch(e){if(current===epoch&&!disposed)report(e)}}
 const off=identity.subscribe(state=>{const next=state.session?.actor||'';if(next!==signature){signature=next;epoch++;service.dispose();form.reset();root.querySelector('[data-inbox]')!.replaceChildren();void refresh();}
  const account=root.querySelector('[data-account]')!;account.replaceChildren();const button=node('button','',state.session?(state.session.actor===reviewer?'Project reviewer connected':'Personal Graffiti account connected'):'Continue with Graffiti');button.onclick=()=>identity.loginVisitor().catch(report);account.append(button);form.querySelector<HTMLButtonElement>('[type=submit]')!.disabled=!state.session||busy;
 });
 form.onsubmit=async event=>{event.preventDefault();const session=identity.currentSession();if(!session||busy)return;busy=true;const current=epoch,button=form.querySelector<HTMLButtonElement>('[type=submit]')!;button.disabled=true;try{
  const data=new FormData(form),get=(key:string)=>String(data.get(key)||'').trim(),link=get('link');if(data.get('consent')!=='on')throw Error('Publication consent is required.');const hasLocation=get('latitude')!==''||get('longitude')!=='';if(hasLocation&&(!get('latitude')||!get('longitude')))throw Error('Provide both latitude and longitude, or leave both blank.');
  await service.submit({operationId,event:{title:get('title'),description:get('description'),startsAt:localToInstant(get('start'),get('zone')),endsAt:localToInstant(get('end'),get('zone')),timeZone:get('zone'),...(link?{links:[link]}:{})},venue:{name:get('venue'),address:get('address'),...(hasLocation?{location:{latitude:Number(get('latitude')),longitude:Number(get('longitude'))}}:{})}},session);
  if(current!==epoch)return;operationId=crypto.randomUUID();form.reset();status.textContent='Submitted privately for review. It is not public yet.';await refresh();
 }catch(e){if(current===epoch)report(e)}finally{busy=false;button.disabled=!identity.currentSession();}};
 root.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick=()=>void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},30000);const focus=()=>void refresh();window.addEventListener('focus',focus);void refresh();
 return ()=>{disposed=true;epoch++;clearInterval(timer);window.removeEventListener('focus',focus);off();identity.dispose();service.dispose();};
}
