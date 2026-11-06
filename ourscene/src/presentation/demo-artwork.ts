/** Allowlisted bundled assets, consumed only in the local sandbox. */
const assets = import.meta.glob('../assets/artists/*.webp', { eager:true, query:'?url', import:'default' }) as Record<string,string>;
export function demoArtwork(key?: string): string | undefined {
  const workspaceDemo=typeof window!=='undefined'&&(window.parent as unknown as {gtWorkspace?:{demo:boolean}}).gtWorkspace?.demo;
  if ((!workspaceDemo && import.meta.env.VITE_GRAFFITI_MODE !== 'local') || !key || !/^artist-(0[1-9]|1[0-2])$/.test(key)) return;
  return assets[`../assets/artists/${key}.webp`];
}

export const demoArtistDescriptions = [
 'Fictional jazz singer in a blue jacket beside an upright bassist',
 'Fictional saxophonist and drummer in a warm jazz club',
 'Fictional soul singer at a vintage microphone under amber lights',
 'Fictional indie band led by a singer playing a red electric guitar',
 'Fictional punk singer and guitarist on a red-lit stage',
 'Fictional blues guitarist playing a hollow-body guitar',
 'Fictional folk songwriter playing acoustic guitar in a lantern-lit room',
 'Fictional acoustic singer playing a nylon-string guitar',
 'Fictional folk ensemble with fiddle and guitars around one microphone',
 'Fictional electronic musician performing at a synthesizer',
 'Fictional DJ wearing headphones at a violet-lit mixing desk',
 'Fictional experimental percussionist playing drums and electronics',
] as const;
export function demoArtistDescription(key: string): string { const index = Number(key.slice(-2))-1; return demoArtistDescriptions[index] ?? 'Fictional performer on stage'; }
