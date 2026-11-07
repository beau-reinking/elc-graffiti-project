import { Temporal } from '@js-temporal/polyfill';

export function timeZone(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || /^[+-]/.test(value)) throw new Error('Use an IANA timezone, such as America/New_York.');
  try { new Intl.DateTimeFormat('en', { timeZone: value.trim() }); } catch { throw new Error('Use a valid IANA timezone, such as America/New_York.'); }
  return value.trim();
}
export function localToInstant(local: string, zone: string): number {
  timeZone(zone);
  try { return Temporal.PlainDateTime.from(local).toZonedDateTime(zone, { disambiguation: 'reject' }).epochMilliseconds; }
  catch { throw new Error('That local time is invalid or ambiguous in this timezone (possibly a daylight-saving change). Choose a different time.'); }
}
export function instantToLocal(instant: number, zone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(instant).toZonedDateTimeISO(zone).toPlainDateTime().toString({ smallestUnit: 'minute' });
}
export function todayIn(zone: string, now = Date.now()): string { return Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(zone).toPlainDate().toString(); }
export function addDays(day: string, amount: number): string { return Temporal.PlainDate.from(day).add({ days: amount }).toString(); }
export interface DateRange { readonly from: number; readonly until: number }
export function dateRange(from: string, through: string, zone: string): DateRange {
  timeZone(zone);
  let start: Temporal.PlainDate, end: Temporal.PlainDate;
  try { start = Temporal.PlainDate.from(from); end = Temporal.PlainDate.from(through); } catch { throw new Error('Choose valid start and end dates.'); }
  if (Temporal.PlainDate.compare(start, end) > 0) throw new Error('The end date must be on or after the start date.');
  // toZonedDateTime(zone) chooses each actual day's start, even at DST changes.
  return Object.freeze({ from: start.toZonedDateTime(zone).epochMilliseconds, until: end.add({ days: 1 }).toZonedDateTime(zone).epochMilliseconds });
}
export function datePreset(preset: 'today' | 'tomorrow' | 'weekend', zone: string, now = Date.now()) {
  const today = Temporal.PlainDate.from(todayIn(zone, now));
  const first = preset === 'tomorrow' ? today.add({ days: 1 }) : preset === 'weekend' ? today.add({ days: (6 - today.dayOfWeek + 7) % 7 }) : today;
  // On Sunday, this weekend means the Saturday/Sunday containing today.
  const start = preset === 'weekend' && today.dayOfWeek === 7 ? today.subtract({ days: 1 }) : first;
  return { from: start.toString(), through: (preset === 'weekend' ? start.add({ days: 1 }) : start).toString() };
}
export function overlaps(start: number, end: number, range: DateRange): boolean { return start < range.until && end > range.from; }
