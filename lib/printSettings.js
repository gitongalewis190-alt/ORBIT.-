// PDF print settings and copy retention. Pure, so it can be tested without the app running.
export const DEFAULT_RETENTION_DAYS = 365;

export const RETENTION_OPTIONS = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: 'Six months' },
  { days: 365, label: 'One year' },
  { days: 730, label: 'Two years' },
  { days: 1825, label: 'Five years' },
  { days: 3650, label: 'Ten years' },
];

export const TEXT_SIZES = [
  { key: 'small', label: 'Small', scale: 0.85 },
  { key: 'standard', label: 'Standard', scale: 1 },
  { key: 'large', label: 'Large', scale: 1.15 },
];

export const ALIGNMENTS = [
  { key: 'left', label: 'Left' },
  { key: 'justify', label: 'Justified' },
  { key: 'center', label: 'Centred' },
  { key: 'right', label: 'Right' },
];

// Which medals the record shows. Compact layouts use 'earned', which hides every locked medal.
export const MEDAL_RULES = [
  { key: 'earned', label: 'Earned only' },
  { key: 'near', label: 'Earned and the three nearest' },
  { key: 'all', label: 'Every medal' },
];

export const DEFAULT_PRINT = {
  format: 'a4',
  orientation: 'portrait',
  colour: true,
  textSize: 'standard',
  align: 'left',
  medals: 'near',
  retentionDays: DEFAULT_RETENTION_DAYS,
};

export const sizeScale = key => (TEXT_SIZES.find(t => t.key === key) ?? TEXT_SIZES[1]).scale;

export function retentionLabel(days) {
  return (RETENTION_OPTIONS.find(r => r.days === days) ?? { label: `${days} days` }).label;
}

// Timestamp for when a stored copy expires.
export function expiresAt(days, now = Date.now()) {
  return new Date(now + days * 86400000).toISOString();
}
