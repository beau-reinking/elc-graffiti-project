import { configuredVenue } from '../../src/infrastructure/venue-config';
export const config = configuredVenue({
  id: 'lantern', brandName: 'The Lantern', onlineActor: import.meta.env.VITE_LANTERN_ACTOR,
  tagline: 'Songs up close. A little light after dark.', description: 'An intimate home for folk, acoustic sets, and original songwriting. A fictional venue in the local sandbox.',
  theme: { accent: '#f4cb78', background: '#3b3022' }, testHandle: 'lantern-demo', defaultTimeZone: 'America/New_York',
  defaultAddress: '303 Demo Lantern Way, East Village, New York, NY 10009 (fictional)', defaultLocation: { latitude: 40.7275, longitude: -73.9805 },
});
