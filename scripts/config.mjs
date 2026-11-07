import {readFile} from 'node:fs/promises';
export function isActorDID(actor){return typeof actor==='string' && (/^did:plc:[a-z2-7]{24}$/.test(actor)||/^did:web:[A-Za-z0-9._%+-]+(?::[A-Za-z0-9._%+-]+)*$/.test(actor));}
export async function configuration(profile){
 let config={};try{config=JSON.parse(process.env.GT_RELEASE_CONFIG||await readFile(new URL('../release.config.json',import.meta.url),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(profile==='preview')return {...config,venues:config.venues||[],preview:true};
 const errors=[];
 if(!isActorDID(config.moderatorActor))errors.push('Set moderatorActor to the canonical did:plc or did:web identifier emitted by Graffiti, not a handle or website URL.');
 if(config.demo===true)errors.push('Production demo mode must be disabled.');
 if(config.eventPublishing!=='moderator-approved-submissions')errors.push('Event publishing must require moderator approval.');
 for(const venue of config.venues||[]){
  if(!isActorDID(venue.actor)||!venue.name||!venue.ownerApproved||!venue.address||!venue.timeZone)errors.push('Every venue needs actor, name, address, timeZone and ownerApproved.');
  try{new Intl.DateTimeFormat('en',{timeZone:venue.timeZone});}catch{errors.push('Invalid venue timeZone.');}
  if(!venue.profileReference||!venue.events?.some(e=>e.reference&&e.title&&Number.isFinite(Date.parse(e.startsAt))&&Date.parse(e.startsAt)>Date.now()))errors.push('Every venue needs its published profile reference and an accurate upcoming event reference, title and startsAt.');
 }
 if(new Set((config.venues||[]).map(v=>v.actor)).size!==(config.venues||[]).length)errors.push('Venue actors must be distinct.');
 if(errors.length)throw Error('Launch configuration is incomplete:\n'+errors.map(e=>' • '+e).join('\n'));
 return config;
}
