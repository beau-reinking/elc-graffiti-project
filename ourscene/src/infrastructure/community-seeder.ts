import type { Graffiti } from '@graffiti-garden/api';
import type { VenueConfig } from '../application/ports';
import { CommunityRecord, UsernameClaim, type CommunityValue } from '../domain/community';
import { communityChannel, usernameChannel } from './community-repository';
import { localActorForHandle } from './venue-config';
export const demoVisitors = ['river_notes','milo_live','sky_sounds'] as const;
export async function seedCommunity(client: Graffiti, configs: readonly VenueConfig[], now = Date.now()) {
  if (configs.some(v => !v.venueActor.startsWith('did:local:'))) throw new Error('Community demos require local sandbox identities.');
  let written = 0; const actors = demoVisitors.map(localActorForHandle), claims: UsernameClaim[] = [];
  for await (const result of client.discover([usernameChannel],{})) { if (result.error) throw result.error; if (!result.tombstone) try { claims.push(new UsernameClaim(result.object,result.object.value)); } catch { /* Unsupported data. */ } }
  for (const [index,name] of demoVisitors.entries()) if (!claims.some(c => c.actor === actors[index])) { await client.post<{}>({ channels:[usernameChannel],value:{ type:'UsernameClaim',schemaVersion:1,username:name,published:now } },{ actor:actors[index] }); written++; }
  for (const venue of configs) {
    const records: CommunityRecord[] = [];
    for await (const result of client.discover([communityChannel(venue.venueActor)],{})) { if (result.error) throw result.error; if (!result.tombstone) try { records.push(new CommunityRecord(result.object,result.object.value)); } catch { /* Unsupported data. */ } }
    const ref = (index: number,id: string) => ({ actor:actors[index],id });
    const values: { actor: string; value: CommunityValue }[] = [];
    const base = { schemaVersion:1 as const,venueActor:venue.venueActor };
    values.push({ actor:actors[0],value:{ ...base,type:'CommunityPost',id:'demo-v3:event-post',body:'Who else is coming? I’d love to hear which performer you’re most excited about.',eventId:`sandbox-v2:${venue.id}:0`,published:now-60000 } });
    values.push({ actor:actors[1],value:{ ...base,type:'CommunityPost',id:'demo-v3:general-post',body:'Love seeing independent music in this neighborhood. What should I catch here next?',published:now-120000 } });
    for (let depth=0;depth<5;depth++) values.push({ actor:actors[(depth+1)%3],value:{ ...base,type:'CommunityReply',id:`demo-v3:reply-${depth}`,root:ref(0,'demo-v3:event-post'),parent:depth === 0 ? ref(0,'demo-v3:event-post') : ref(depth%3,`demo-v3:reply-${depth-1}`),body:['I’m here for the opening set!','Same! Planning to arrive when doors open.','There’s a great view from the side of the stage.','Thanks for the tip — see you there.','A little community before the music starts.'][depth],published:now-50000+depth*1000 } });
    values.push({ actor:actors[2],value:{ ...base,type:'CommunityPost',id:'demo-v3:moderated-post',body:'A fictional example of a post hidden by the venue moderator.',published:now-180000 } });
    values.push({ actor:venue.venueActor,value:{ ...base,type:'CommunityModeration',id:'demo-v3:moderation',target:ref(2,'demo-v3:moderated-post'),hidden:true,published:now-170000 } });
    for (const { actor,value } of values) {
      const exists = records.some(r => r.actor === actor && (r.value.id === value.id || (r.value.type === 'CommunityRemoval' && r.value.targetId === value.id)));
      if (!exists) { await client.post<{}>({ value:{ ...value },channels:[communityChannel(venue.venueActor)] },{ actor }); written++; }
    }
  }
  return written;
}
