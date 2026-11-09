// The deletion window rules. No imports, so tests can load it directly.
export const DELETION_WINDOW_DAYS = 60;
const DAY = 86400000;

// Whole days left, rounded up. Never negative.
export function daysLeft(scheduledFor, now = Date.now()) {
  const ms = new Date(scheduledFor).getTime() - now;
  return Math.max(0, Math.ceil(ms / DAY));
}

// Date in Nairobi time, for the banner and the settings row.
export function deletionDate(scheduledFor) {
  return new Date(scheduledFor).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi',
  });
}
