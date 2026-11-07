import { configuredVenue } from '../../src/infrastructure/venue-config';
export const config = configuredVenue({
  id: 'red-room',
  onlineActor: import.meta.env.VITE_RED_ROOM_ACTOR,
  brandName: 'Red Room',
  tagline: 'Small stage. Big energy. Come as you are.',
  description: 'A home for independent bands, loud ideas, and nights you will talk about tomorrow. This is a fictional venue for the example app.',
  theme: { accent: '#ffac93', background: '#48262a' },
  testHandle: 'red-room-demo', defaultTimeZone: 'America/New_York',
  defaultAddress: '202 Demo Stage Street, Lower East Side, New York, NY 10002 (fictional)', defaultLocation: { latitude: 40.7222, longitude: -73.9875 },
});
