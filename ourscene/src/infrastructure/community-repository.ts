import type { Graffiti } from '@graffiti-garden/api';
import { CommunityRecord, UsernameClaim, type CommunityValue, type UsernameValue } from '../domain/community';
import type { CommunityReader, CommunityWriter, UsernameReader, UsernameWriter } from '../application/community-ports';
import type { Session, SourceListener } from '../application/ports';
import { GraffitiObservation, browserPolling, type PollEnvironment } from './observation';
export const usernameChannel = 'music-venues:v1:usernames';
export const communityChannel = (actor: string) => `music-venues:v1:community:${encodeURIComponent(actor)}`;
const schema = (types: string[]) => ({ type: 'object', required: ['value'], properties: { value: { type: 'object', required: ['type', 'schemaVersion'], properties: { type: { enum: types }, schemaVersion: { const: 1 } } } } } as const);
export class GraffitiCommunityRepository implements CommunityReader, CommunityWriter, UsernameReader, UsernameWriter {
  constructor(private readonly client: Graffiti, private readonly environment: PollEnvironment = browserPolling) {}
  observeCommunity(actor: string, listener: SourceListener<CommunityRecord>) { return new GraffitiObservation(this.client, [communityChannel(actor)], schema(['CommunityPost','CommunityReply','CommunityRemoval','CommunityModeration']), raw => new CommunityRecord(raw, raw.value), `community:${actor}`, listener, this.environment); }
  observeUsernames(listener: SourceListener<UsernameClaim>) { return new GraffitiObservation(this.client, [usernameChannel], schema(['UsernameClaim']), raw => new UsernameClaim(raw, raw.value), 'usernames', listener, this.environment); }
  async claim(value: UsernameValue, session: Session) { const raw = await this.client.post<{}>({ value: { ...value }, channels: [usernameChannel] }, session); return new UsernameClaim(raw, raw.value); }
  async publish(value: CommunityValue, session: Session) { const raw = await this.client.post<{}>({ value: { ...value }, channels: [communityChannel(value.venueActor)] }, session); return new CommunityRecord(raw, raw.value); }
  async remove(record: CommunityRecord, marker: CommunityValue, session: Session) {
    await this.publish(marker, session);
    try { await this.client.delete(record.url, session); return []; } catch { return ['Removed from the app, but the original object could not be deleted from its source.']; }
  }
}
