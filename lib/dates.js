// All "today" logic runs on Nairobi time (UTC+3), so a topic assigned at 6 AM
// is dated correctly for you regardless of the phone's location.
export const TZ = 'Africa/Nairobi';

export const today = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: TZ });

export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function prettyDate(iso) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}
