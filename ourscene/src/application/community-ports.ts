import type { CommunityRecord, CommunityValue, UsernameClaim, UsernameValue } from '../domain/community';
import type { IdentityPort, Observation, Session, SourceListener } from './ports';
export interface CommunityReader { observeCommunity(venueActor: string, listener: SourceListener<CommunityRecord>): Observation }
export interface CommunityWriter { publish(value: CommunityValue, session: Session): Promise<CommunityRecord>; remove(record: CommunityRecord, marker: CommunityValue, session: Session): Promise<readonly string[]> }
export interface UsernameReader { observeUsernames(listener: SourceListener<UsernameClaim>): Observation }
export interface UsernameWriter { claim(value: UsernameValue, session: Session): Promise<UsernameClaim> }
export interface SessionIdentityPort extends IdentityPort { loginVisitor(): Promise<void>; loginOwner(): Promise<void>; selectSession(actor: string): void }
