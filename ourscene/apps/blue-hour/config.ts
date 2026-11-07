import { configuredVenue } from '../../src/infrastructure/venue-config';
export const config = configuredVenue({
  id: 'blue-hour',
  onlineActor: import.meta.env.VITE_BLUE_HOUR_ACTOR,
  brandName: 'Blue Hour',
  tagline: 'Late sets. Close company. Room for discovery.',
  description: 'An intimate space for jazz, improvised sounds, and the artists finding their next thing. This is a fictional venue for the example app.',
  theme: { accent: '#8bc9e8', background: '#142d42' },
  testHandle: 'blue-hour-demo', defaultTimeZone: 'America/New_York',
  defaultAddress: '101 Demo Jazz Lane, Greenwich Village, New York, NY 10003 (fictional)', defaultLocation: { latitude: 40.7308, longitude: -73.9973 },
});
