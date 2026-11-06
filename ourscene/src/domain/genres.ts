export const GENRES = ['Rock', 'Indie', 'Pop', 'Hip-hop/Rap', 'Electronic', 'Jazz', 'Blues', 'Folk', 'Country', 'R&B/Soul', 'Classical', 'Metal', 'Punk', 'Reggae', 'Latin', 'World', 'Experimental', 'Other'] as const;
export type Genre = typeof GENRES[number];
export function genres(value: unknown): readonly Genre[] {
  if (!Array.isArray(value) || value.length > GENRES.length || value.some(g => !GENRES.includes(g))) throw new Error('Choose genres from the shared list.');
  return Object.freeze([...new Set(value)] as Genre[]);
}
