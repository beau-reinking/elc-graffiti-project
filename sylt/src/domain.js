export const APP = 'encore.music.v1';
export const MAX_BYTES = 100 * 1024 * 1024;
export const MAX_SECONDS = 300;
export const byNewest = (a,b) => b.value.createdAt - a.value.createdAt || a.url.localeCompare(b.url);
export function friendsFrom(objects, actor, blocked = []) {
  const requests = objects.filter(o => o.value.type === 'request');
  const connected = new Set();
  for (const acceptance of objects.filter(o => o.value.type === 'accept')) {
    const request = requests.find(r => r.url === acceptance.value.request);
    if (!request || request.value.target !== acceptance.actor || acceptance.value.createdAt < request.value.createdAt) continue;
    const other = request.actor === actor ? acceptance.actor : acceptance.actor === actor ? request.actor : null;
    if (!other || blocked.includes(other)) continue;
    const removed = objects.some(o => o.value.type === 'unfriend' && o.value.createdAt >= acceptance.value.createdAt && ((o.actor === actor && o.value.target === other) || (o.actor === other && o.value.target === actor)));
    if (!removed) connected.add(other);
  }
  return [...connected];
}
export function pendingRequests(objects, actor, blocked = []) {
  return objects.filter(r => r.value.type === 'request' && (r.actor === actor || r.value.target === actor) && !blocked.includes(r.actor) && !blocked.includes(r.value.target) && !objects.some(o => ((o.value.type === 'accept' || o.value.type === 'decline') && o.value.request === r.url && o.actor === r.value.target) || (o.value.type === 'unfriend' && o.value.createdAt >= r.value.createdAt && ((o.actor === r.actor && o.value.target === r.value.target) || (o.actor === r.value.target && o.value.target === r.actor)))));
}
export function validateMedia(file, duration) {
  if (!file || !file.size) throw new Error('Choose a recording with audio or video.');
  if (!/^(audio|video)\//.test(file.type)) throw new Error('Choose a supported audio or video file.');
  if (file.size > MAX_BYTES) throw new Error('This file is over 100 MB. Choose a smaller recording.');
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('This browser could not play that recording. Try another format.');
  if (duration > MAX_SECONDS + .25) throw new Error('Choose a recording that is five minutes or shorter.');
}
export function eligiblePost(post, actor, friends, blocked) {
  return post.value.type === 'shared' && (post.actor === actor || friends.includes(post.actor)) && !blocked.includes(post.actor);
}
export function safeText(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function validRecord(o){
 const v=o?.value;if(!v||v.app!==APP||v.version!==1||!Number.isFinite(v.createdAt)||typeof o.actor!=='string'||typeof o.url!=='string')return false;
 const str=k=>typeof v[k]==='string';
 if(['excerpt','excerpt-draft'].includes(v.type))return str('media')&&str('title')&&str('mediaType')&&Number.isFinite(v.duration);
 if(v.type==='clip-selection')return str('source')&&str('operationId')&&Number.isFinite(v.start)&&Number.isFinite(v.end)&&v.end>v.start&&v.end-v.start<=60;
 if(['lineage','excerpt-publication','excerpt-removal'].includes(v.type))return true;
 if(v.type==='profile')return str('name')&&(!v.avatar||str('avatar'))&&(!v.instrument||str('instrument'));
 if(['practice','shared','public'].includes(v.type))return str('media')&&str('title')&&str('mediaType')&&/^(audio|video)\//.test(v.mediaType)&&Number.isFinite(v.duration)&&(!v.caption||str('caption'))&&(v.type!=='shared'||(Array.isArray(v.audience)&&v.audience.every(a=>typeof a==='string')));
 if(['request','unfriend'].includes(v.type))return str('target');
 if(['accept','decline'].includes(v.type))return str('request');
 if(v.type==='comment')return str('post')&&str('text')&&v.text.length<=1000;
 if(v.type==='settings')return ['blocked','hidden'].every(k=>v[k]===undefined||(Array.isArray(v[k])&&v[k].every(a=>typeof a==='string')));
 return false;
}
