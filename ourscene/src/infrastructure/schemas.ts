const published = { type: 'integer', minimum: 0, maximum: 8640000000000000 } as const;
const text = { type: 'string', minLength: 1 } as const;
export const profileSchema = {
  type: 'object', required: ['value'], properties: { value: {
    type: 'object', required: ['type', 'schemaVersion', 'name', 'published'],
    properties: { type: { const: 'VenueProfile' }, schemaVersion: { const: 1 }, name: { ...text, maxLength: 120 }, published,
      website: text, address: { ...text, maxLength: 300 }, location: { type: 'object', required: ['latitude', 'longitude'], properties: {
        latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 },
      } },
    },
  } },
} as const;
export const announcementSchema = {
  type: 'object', required: ['value'], properties: { value: {
    type: 'object', required: ['type', 'schemaVersion', 'venueActor', 'body', 'published'],
    properties: { type: { const: 'Announcement' }, schemaVersion: { const: 1 }, venueActor: text, body: { ...text, maxLength: 4000 },
      title: { ...text, maxLength: 140 }, links: { type: 'array', maxItems: 5, items: text }, published,
    },
  } },
} as const;
export const directoryChannel = 'music-venues:v1:directory';
export const announcementChannel = (actor: string) => `music-venues:v1:announcements:${encodeURIComponent(actor)}`;
