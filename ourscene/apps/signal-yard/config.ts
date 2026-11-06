import { configuredVenue } from '../../src/infrastructure/venue-config';
export const config = configuredVenue({
  id: 'signal-yard', brandName: 'Signal Yard', onlineActor: import.meta.env.VITE_SIGNAL_YARD_ACTOR,
  tagline: 'Find your frequency. Stay for the night.', description: 'Electronic music, experimental live sets, and independent DJs. A fictional venue in the local sandbox.',
  theme: { accent: '#d2b3ff', background: '#302344' }, testHandle: 'signal-yard-demo', defaultTimeZone: 'America/New_York',
  defaultAddress: '404 Demo Signal Avenue, Lower Manhattan, New York, NY 10013 (fictional)', defaultLocation: { latitude: 40.7135, longitude: -73.995 },
});
