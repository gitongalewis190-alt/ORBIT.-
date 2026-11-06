'use client';

// Loading placeholder. Shows the shape of the content while data arrives,
// so the screen never sits blank or looks frozen.
export default function Skeleton({ lines = 3, label = 'Loading' }) {
  return (
    <div className="skeleton-wrap" role="status" aria-label={label}>
      <div className="skeleton skel-title" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton skel-line" style={{ width: `${92 - i * 14}%` }} />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
