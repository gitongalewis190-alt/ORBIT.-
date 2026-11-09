// A short burst of falling confetti after an earned swap. Skipped when the phone asks for less motion.
const COLORS = ['#c4623a', '#3f7d6a', '#e4b65a', '#5b6bbf', '#e06c9f', '#8fd19e'];

export function confetti(count = 90) {
  if (typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.createElement('div');
  host.className = 'confetti-host';
  host.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = COLORS[i % COLORS.length];
    p.style.animationDelay = `${Math.random() * 0.4}s`;
    p.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 240}px`);
    p.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 4400);
}
