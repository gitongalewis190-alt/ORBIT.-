'use client';
import { useEffect, useState } from 'react';

// Three concentric rings, outer to inner: study, journal, review.
// Each value is a fraction from 0 to 1. Rings draw in on mount.
export default function Rings({ study = 0, journal = 0, review = 0, size = 168 }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 60);
    return () => clearTimeout(t);
  }, []);

  const rings = [
    { value: study, r: size / 2 - 10, color: 'var(--ring-1)', label: 'Study' },
    { value: journal, r: size / 2 - 26, color: 'var(--ring-2)', label: 'Journal' },
    { value: review, r: size / 2 - 42, color: 'var(--ring-3)', label: 'Review' },
  ];
  const stroke = 12;
  const cx = size / 2;

  return (
    <div className="rings" role="img"
      aria-label={`Study ${Math.round(study * 100)}%, journal ${Math.round(journal * 100)}%, review ${Math.round(review * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map(({ value, r, color }, i) => {
          const c = 2 * Math.PI * r;
          const v = Math.max(0, Math.min(1, value));
          return (
            <g key={i}>
              <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
              <circle
                cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={shown ? c * (1 - v) : c}
                transform={`rotate(-90 ${cx} ${cx})`}
                style={{ transition: `stroke-dashoffset 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 0.15}s` }}
              />
            </g>
          );
        })}
      </svg>
      <div className="rings-legend">
        {rings.map(({ label, color, value }) => (
          <div key={label} className="rings-row">
            <span className="rings-dot" style={{ background: color }} />
            <span className="rings-label">{label}</span>
            <span className="rings-value">{Math.round(value * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
