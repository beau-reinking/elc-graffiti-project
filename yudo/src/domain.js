export const APP='urn:soundcheck:musicians:v1';
export const INSTRUMENTS=['Guitar','Bass','Drums','Vocals','Keys','Saxophone','Violin','Trumpet','Production','DJing','Other'];
export const GENRES=['Indie rock','Alternative','Jazz','Soul','R&B','Funk','Pop','Electronic','Hip-hop','Folk','Country','Metal','Classical','Other'];
export const INTENTS={band:'Form a band',live:'Play live',session:'Record sessions'};
export const TYPES=['profile','draft','settings','pass','like','closure','message','block','report','exclusion','asset'];
export const MAX_BYTES=50*1024*1024;
export const MIME=['audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','video/mp4','video/webm'];
export const SCHEMA={type:'object',properties:{value:{type:'object',properties:{app:{const:APP},version:{const:1},type:{enum:TYPES},operationId:{type:'string'},revision:{type:'integer',minimum:1}},required:['app','version','type','operationId','revision']}},required:['value']};
const strings=x=>Array.isArray(x)&&x.every(s=>typeof s==='string');
export function valid(o){const v=o?.value;if(!o?.actor||!o?.url||v?.app!==APP||v.version!==1||!TYPES.includes(v.type)||!Number.isInteger(v.revision)||v.revision<1||typeof v.operationId!=='string')return false;
 if(['like','pass','block','exclusion'].includes(v.type)&&typeof v.target!=='string')return false;
 if(v.type==='closure'&&(!strings(v.likes)||v.likes.length!==2||typeof v.target!=='string'))return false;
 if(v.type==='message'&&(!strings(v.likes)||v.likes.length!==2||typeof v.target!=='string'||typeof v.text!=='string'||v.text.length>2000))return false;
 if(v.type==='profile'&&(typeof v.name!=='string'||!v.name||v.name.length>60||!strings(v.instruments)||!strings(v.genres)||!strings(v.seeking)||!strings(v.openTo)||!strings(v.inspirations)||!Number.isFinite(v.location?.lat)||!Number.isFinite(v.location?.lng)||Math.abs(v.location.lat)>90||Math.abs(v.location.lng)>180||typeof v.location.city!=='string'||!Array.isArray(v.samples)||v.samples.length>3||v.samples.some(s=>!s||typeof s.media!=='string'||typeof s.mediaType!=='string'||typeof s.title!=='string'||!Number.isFinite(s.duration)||s.duration<=0||s.duration>60)))return false;
 if(v.type==='profile'&&v.bio!==undefined&&typeof v.bio!=='string')return false;
 if(v.type==='profile'&&v.avatar!==undefined&&typeof v.avatar!=='string')return false;
 return true;
}
export function compare(a,b){return a.value.revision-b.value.revision||a.url.localeCompare(b.url)}
export function latest(rows,type,actor){return rows.filter(o=>o.actor===actor&&o.value.type===type).sort(compare).at(-1)}
export function latestTargets(rows,type,actor){const out=new Map();for(const o of rows.filter(o=>o.actor===actor&&o.value.type===type)){const p=out.get(o.value.target);if(!p||compare(p,o)<0)out.set(o.value.target,o)}return [...out.values()]}
export function profiles(rows){const actors=[...new Set(rows.filter(o=>o.value.type==='profile').map(o=>o.actor))];return actors.map(a=>latest(rows,'profile',a))}
export function blocks(rows,actor){return latestTargets(rows,'block',actor).filter(o=>o.value.active!==false).map(o=>o.value.target)}
export const coarse=(lat,lng)=>({lat:Math.round(lat*10)/10,lng:Math.round(lng*10)/10});
export function distance(a,b){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlng=(b.lng-a.lng)*r;const h=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2;return 3958.8*2*Math.asin(Math.sqrt(Math.min(1,h)))}
const overlap=(a=[],b=[])=>a.filter(x=>b.includes(x)).length;
export function connections(rows,me){const denied=blocks(rows,me), result=[];
 for(const mine of latestTargets(rows,'like',me)){
  const other=mine.value.target;if(denied.includes(other)||mine.value.active===false||other===me)continue;
  const theirs=latestTargets(rows,'like',other).find(o=>o.value.target===me&&o.value.active!==false);if(!theirs)continue;
  const likes=[mine.url,theirs.url].sort();
  const closed=rows.some(o=>o.value.type==='closure'&&[me,other].includes(o.actor)&&o.value.target===(o.actor===me?other:me)&&o.value.likes.some(x=>likes.includes(x)));
  if(!closed)result.push({actor:other,likes,id:JSON.stringify(likes),profile:latest(rows,'profile',other)});
 }return result;
}
export function conversation(rows,me,c){if(!connections(rows,me).some(x=>x.id===c.id))return [];return rows.filter(o=>o.value.type==='message'&&[me,c.actor].includes(o.actor)&&o.value.target===(o.actor===me?c.actor:me)&&JSON.stringify([...o.value.likes].sort())===c.id).sort((a,b)=>(a.value.createdAt-b.value.createdAt)||a.url.localeCompare(b.url))}
export function discover(rows,me,settings={},moderator=''){
 const own=latest(rows,'profile',me)?.value;if(!own)return [];
 const hidden=new Set([...blocks(rows,me),...latestTargets(rows,'pass',me).map(o=>o.value.target),...latestTargets(rows,'like',me).map(o=>o.value.target),...rows.filter(o=>o.actor===moderator&&o.value.type==='exclusion'&&o.value.active!==false).map(o=>o.value.target)]);
 return profiles(rows).filter(o=>o.actor!==me&&!hidden.has(o.actor)).map(o=>{const p=o.value,miles=distance(own.location,p.location),intentFit=overlap(own.seeking,p.openTo)+overlap(own.openTo,p.seeking),instrumentFit=overlap(settings.instruments,p.instruments),genres=overlap(own.genres,p.genres);return {object:o,miles,intentFit,genres,score:instrumentFit*100+intentFit*50+genres*10+overlap(own.inspirations,p.inspirations)}}).filter(({object:o,miles})=>miles<=(settings.radius||50)&&(!settings.instruments?.length||overlap(settings.instruments,o.value.instruments)>0)&&(!settings.genres?.length||overlap(settings.genres,o.value.genres)>0)&&(!settings.intent||o.value.openTo.includes(settings.intent))).sort((a,b)=>b.score-a.score||a.miles-b.miles||a.object.actor.localeCompare(b.object.actor));
}
export function validateProfile(p){if(!p.name?.trim())throw Error('Add a display name.');if(!p.location?.city||!Number.isFinite(p.location.lat)||!Number.isFinite(p.location.lng))throw Error('Choose a city.');if(!p.instruments?.length)throw Error('Choose your primary instrument or role.');if(!p.genres?.length)throw Error('Choose at least one genre.');if(!p.seeking?.length&&!p.openTo?.length)throw Error('Choose what you’re seeking or open to.');if(p.samples?.length>3)throw Error('You can publish up to three samples.');}
export function validateMedia(file,duration){if(!MIME.includes(file.type))throw Error('Choose an MP3, M4A, WAV, MP4, or WebM file.');if(file.size>MAX_BYTES)throw Error('Samples must be 50 MB or smaller.');if(!Number.isFinite(duration)||duration<=0||duration>60)throw Error('Samples must be playable and no longer than 60 seconds.');}
export const CITIES=[['New York, NY',40.7,-74],['Brooklyn, NY',40.7,-73.9],['Los Angeles, CA',34.1,-118.2],['Chicago, IL',41.9,-87.6],['Nashville, TN',36.2,-86.8],['Austin, TX',30.3,-97.7],['Atlanta, GA',33.7,-84.4],['Boston, MA',42.4,-71.1],['Philadelphia, PA',40,-75.2],['Seattle, WA',47.6,-122.3],['London, UK',51.5,-0.1],['Toronto, CA',43.7,-79.4]];

/** Incomplete private drafts omit coordinates until the musician selects a city. */
export function createDraft(saved){
 const draft=structuredClone(saved||{name:'',bio:'',avatar:'',location:{city:''},instruments:[],genres:[],inspirations:[],samples:[],seeking:[],openTo:[],statement:''});
 draft.location={city:'',...draft.location};
 for(const key of ['lat','lng'])if(draft.location[key]==null)delete draft.location[key];
 return draft;
}
