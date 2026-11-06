import {mountEventSubmissions} from './presentation/event-submissions-view';
import type { Graffiti } from '@graffiti-garden/api';
import type { VenueConfig, VenueDirectoryReader } from './application/ports';
import { discussionUrl } from './infrastructure/discussion-navigation';
import { CommunityService } from './application/community-service';
import { GraffitiCommunityRepository } from './infrastructure/community-repository';
import { CommunityView } from './presentation/community-view';
import { FeedService } from './application/feed-service';
import { FeedStore } from './application/feed-store';
import { VenueOwnedPolicy } from './application/policies';
import { VenuePublishingService } from './application/publishing';
import { EventPublishingService } from './application/event-publishing';
import { GraffitiIdentityAdapter } from './infrastructure/identity';
import { loadGraffitiFactory, mode } from './infrastructure/client';
import { GraffitiAnnouncementRepository, GraffitiVenueRepository } from './infrastructure/repositories';
import { GraffitiEventRepository } from './infrastructure/event-repository';
import { AggregatorController, VenueAppController } from './presentation/controllers';
import { ListFeedView } from './presentation/list-feed-view';
import { EventExplorerView } from './presentation/event-explorer-view';
import { appLinks, sandboxVenues } from './venue-catalog';
import { seedSandbox } from './infrastructure/sandbox-seeder';
import { DomVenueView } from './presentation/venue-view';
import { node, required, safeError } from './presentation/dom';
import './presentation/styles.css';

export function makeFeed(client: Graffiti, actor?: string) {
  const profiles = new GraffitiVenueRepository(client), announcements = new GraffitiAnnouncementRepository(client);
  const directory: VenueDirectoryReader = actor === undefined ? profiles : {
    observeVenues: listener => profiles.observeVenues(update => listener({ ...update, records: update.records.filter(venue => venue.actor === actor) })),
  };
  const store = new FeedStore(), events = new GraffitiEventRepository(client);
  return { profiles, announcements, events, store, feed: new FeedService(directory, announcements, new VenueOwnedPolicy(), store, events) };
}

function shell(appName: string) {
  document.title = `${appName} · OurScene`;
  document.body.innerHTML = `<div class="app-shell"><header class="site-header"><a class="brand" href="#"><span class="brand-mark" aria-hidden="true">s.</span><span class="brand-name"></span></a><nav aria-label="Apps"></nav><span class="mode-pill"></span></header><div class="mode-note"></div><main id="app"><p role="status">Connecting to Graffiti…</p></main><footer>Independent spaces. Shared discovery. <a href="https://graffiti.garden/" target="_blank" rel="noopener noreferrer">Powered by Graffiti ↗</a><span>Venue identity claims are unverified.</span></footer></div>`;
  required(document, '.brand-name').textContent = appName;
  required(document, '.mode-pill').textContent = mode === 'local' ? 'LOCAL SANDBOX' : 'DECENTRALIZED';
  required(document, '.mode-note').textContent = mode === 'local' ? 'Sandbox data stays in this browser and site origin. Use decentralized mode for independently hosted apps.' : 'Public announcements from independent venue identities. No account needed to browse.';
  const sandbox = mode === 'local';
  const nav = required(document, 'nav');
  for (const { label, id, url: configured, actor } of appLinks) {
    const inWorkspace=window.parent!==window;
    const href = actor ? `/apps/ourscene/venue/?actor=${encodeURIComponent(actor)}` : inWorkspace ? `/apps/ourscene/${id}/` : sandbox ? `/apps/${id}/` : configured;
    if (href) { const link = node('a', '', label); link.href = href; nav.append(link); }
  }
  if (sandbox) { const link = node('a', 'sandbox-link', 'Sandbox guide'); link.href = '/'; nav.append(link); }
  return required<HTMLElement>(document, '#app');
}

export async function mountAggregator() {
  const root = shell('OurScene');
  document.body.classList.add('soundboard-app');
  const factory = await loadGraffitiFactory();
  const client=factory();
  const { store, feed } = makeFeed(client);
  root.innerHTML = `<section class="board-section"><div class="section-heading"><div><p class="eyebrow">LIVE MUSIC, ON YOUR TERMS</p><h2>Find an event</h2></div><button id="refresh" class="secondary" type="button">Refresh ↻</button></div><p class="refresh-status" role="status"></p><div id="feed"></div></section><section class="venue-directory"><p class="eyebrow">SPACES IN THE NETWORK</p><h2>Meet the venues</h2><p class="muted">Open discovery connects identities, not verified business ownership.</p><div id="venues" class="venue-grid"></div></section><details class="legacy-announcements"><summary>Legacy announcements (not scheduled events)</summary><p class="muted">These older posts have no event dates. They remain readable here and are excluded from map/date filters.</p><div id="legacy-feed"></div></details>`;
  const submissionsRoot=node('section','event-submissions');root.append(submissionsRoot);
  const view = new EventExplorerView(required(root, '#feed'), { discussionUrl:item=>item.venue.name.startsWith('Community: ')?undefined:discussionUrl(item) });
  const legacy = new ListFeedView(required(root, '#legacy-feed'));
  let communityEvents: import('./application/ports').EventFeedItem[]=[];
  const renderFeed=()=>{const snapshot=store.snapshot();view.render({...snapshot,events:[...snapshot.events,...communityEvents],venues:[...snapshot.venues,...communityEvents.map(item=>item.venue)]});};
  const stopSubmissions=mountEventSubmissions(submissionsRoot,client,items=>{communityEvents=items;renderFeed();});
  const controller = new AggregatorController(feed, store, {render:renderFeed,dispose:()=>view.dispose()});
  const unsubscribe = store.subscribe(snapshot => {
    legacy.render(snapshot);
    const venues = required(root, '#venues'); venues.replaceChildren();
    if (!snapshot.venues.length) venues.append(node('p', 'muted', 'New venue profiles will be discovered automatically.'));
    for (const venue of snapshot.venues) {
      const card = node('article', 'venue-tile');
      card.append(node('span', 'venue-monogram', venue.name.slice(0, 2).toUpperCase()), node('h3', '', venue.name), node('span', 'unverified', 'Unverified venue'));
      if (venue.value.address) card.append(node('p', 'muted', venue.value.address));
      if (venue.value.website) { const link = node('a', '', 'Visit website ↗'); link.href = venue.value.website; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link); }
      
      const discussion = node('a', '', 'Open venue & community →'); discussion.href = `/apps/ourscene/venue/?actor=${encodeURIComponent(venue.actor)}`; card.append(discussion);
      venues.append(card);
    }
  });
  const refresh = required<HTMLButtonElement>(root, '#refresh');
  refresh.addEventListener('click', async () => {
    refresh.disabled = true;
    try { await controller.refresh(); required(root, '.refresh-status').textContent = 'Refresh complete. Source health is shown below.'; }
    catch (error) { required(root, '.refresh-status').textContent = safeError(error); }
    finally { refresh.disabled = false; }
  });
  if(mode==='local'&&window.parent!==window)await seedSandbox(client,sandboxVenues);
  await controller.start();
  lifecycle(() => { stopSubmissions(); unsubscribe(); controller.dispose(); legacy.dispose(); (client as Graffiti & {dispose?():void}).dispose?.(); });
}

export async function mountVenue(config: VenueConfig) {
  const root = shell(config.brandName);
  document.body.classList.add('venue-app');
  document.documentElement.style.setProperty('--accent', config.theme.accent);
  document.documentElement.style.setProperty('--hero-bg', config.theme.background);
  const factory = await loadGraffitiFactory();
  const client = factory();
  // Keep construction and identity event listeners in the same synchronous turn.
  const identity = new GraffitiIdentityAdapter(client, config.venueActor);
  const { profiles, announcements, events, store, feed } = makeFeed(client, config.venueActor);
  const view = new DomVenueView(root, config);
  const service = new VenuePublishingService(config, identity, profiles, announcements);
  const controller = new VenueAppController(service, identity, feed, store, view, new EventPublishingService(config, identity, events), discussionUrl);
  const communityRepository = new GraffitiCommunityRepository(client);
  const community = new CommunityService(config.venueActor,identity,communityRepository,communityRepository,communityRepository,communityRepository);
  const communityView = new CommunityView(required(root,'#venue-community'),config,community,identity);
  const offCommunity = store.subscribe(snapshot => community.setEvents(snapshot));
  await controller.start();
  lifecycle(() => { offCommunity(); communityView.dispose(); controller.dispose(); identity.dispose(); (client as Graffiti & {dispose?():void}).dispose?.(); });
}

function lifecycle(dispose: () => void) {
  window.addEventListener('pagehide', dispose, { once: true });
  // A bfcache restore must reconstruct disposed subscriptions and views.
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  if (import.meta.hot) import.meta.hot.dispose(dispose);
}
export function showStartupError(error: unknown) {
  console.error(error);
  const root = document.querySelector('#app') ?? document.body;
  const message = node('p', 'error', `Could not start the app: ${safeError(error)}`); message.setAttribute('role', 'alert');
  root.replaceChildren(message);
}

/** Discovered venues use their own authored public profile, not a fictional route. */
export async function mountDiscoveredVenue() {
 const actor = new URL(location.href).searchParams.get('actor');
 if (!actor || !( /^https:\/\//.test(actor) || (mode==='local'&&actor.startsWith('did:local:')) )) throw new Error('A valid Graffiti venue actor is required.');
 const client=(await loadGraffitiFactory())();
 let stop=()=>{};
 try {
  const venue=await new Promise<import('./domain/models').VenueProfile>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('The public venue profile is unavailable. Retry when connected.')),20000);
   const observation=new GraffitiVenueRepository(client).observeVenues(update=>{
    const profile=update.records.filter(v=>v.actor===actor).sort((a,b)=>b.published-a.published||b.url.localeCompare(a.url))[0];
    if(profile){clearTimeout(timer);resolve(profile);}
   });
   stop=()=>observation.stop();
  });
  await mountVenue({id:'venue',venueActor:actor,brandName:venue.name,tagline:'Independent live music',description:'Community and events from this Graffiti venue identity. Business ownership is unverified.',theme:{accent:'#d8fb78',background:'#192b29'},defaultAddress:venue.value.address});
 } finally {stop();(client as Graffiti & {dispose?():void}).dispose?.();}
}
