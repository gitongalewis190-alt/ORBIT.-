// Plain wording for days and durations, used in the app and in the PDF record.
import { addDays } from './dates';

// "Today", "Yesterday", or a date such as "6 Nov 2026". now is YYYY-MM-DD in Nairobi time.
export function dayLabel(day, now, prettyDate) {
  if (!day) return '';
  const d = String(day).slice(0, 10);
  if (d === now) return 'Today';
  if (d === addDays(now, -1)) return 'Yesterday';
  return prettyDate(d);
}

// 30 becomes "30 min". 90 becomes "1 h 30 min". 120 becomes "2 h".
export function minutesLabel(n) {
  const m = Math.round(Number(n) || 0);
  if (m <= 0) return '0 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

// Clock time in Nairobi, such as "20:14".
export function clockLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi',
  });
}
