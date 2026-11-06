import { config as blue } from '../apps/blue-hour/config';
import { config as red } from '../apps/red-room/config';
import { config as lantern } from '../apps/lantern/config';
import { config as signal } from '../apps/signal-yard/config';
export const sandboxVenues = Object.freeze([blue, red, lantern, signal]);
declare const __GT_VENUES__: {actor:string;name:string}[];
declare const __GT_WEB__: boolean;
const launchVenues = typeof __GT_VENUES__ === 'undefined' ? [] : __GT_VENUES__;
const hosted = typeof __GT_WEB__ !== 'undefined' && __GT_WEB__;
export const appLinks: readonly {label:string;id:string;url?:string;actor?:string}[] = hosted ? [
 {label: 'OurScene',id:'aggregator'},
 ...launchVenues.map(v=>({label:v.name,id:'venue',actor:v.actor})),
] : [
  { label: 'OurScene', id: 'aggregator', url: import.meta.env.VITE_AGGREGATOR_URL },
  { label: blue.brandName, id: blue.id, url: import.meta.env.VITE_BLUE_HOUR_URL },
  { label: red.brandName, id: red.id, url: import.meta.env.VITE_RED_ROOM_URL },
  { label: lantern.brandName, id: lantern.id, url: import.meta.env.VITE_LANTERN_URL },
  { label: signal.brandName, id: signal.id, url: import.meta.env.VITE_SIGNAL_YARD_URL },
] as const;
