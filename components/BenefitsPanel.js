'use client';
import { useEffect, useState } from 'react';
import { BENEFITS, readBenefits } from '../lib/benefits';
import { awardByKey } from '../lib/awards';

// Every benefit, shown as unlocked or locked, with the award that unlocks it.
// Reads the cache written when your statistics load, so it shows the right state at once.
export default function BenefitsPanel() {
  const [active, setActive] = useState([]);
  useEffect(() => {
    setActive(readBenefits());
    const refresh = () => setActive(readBenefits());
    window.addEventListener('orbit:benefits', refresh);
    return () => window.removeEventListener('orbit:benefits', refresh);
  }, []);

  const unlocked = Object.keys(BENEFITS).filter(id => active.includes(id)).length;

  return (
    <section className="benefits" aria-label="Benefits">
      <div className="kicker">Benefits · {unlocked} of {Object.keys(BENEFITS).length} unlocked</div>
      <div className="benefit-list">
        {Object.entries(BENEFITS).map(([id, b]) => {
          const on = active.includes(id);
          const award = awardByKey[b.from];
          return (
            <article key={id} className={`benefit-item ${on ? 'is-on' : ''}`}>
              <span className="benefit-state" aria-hidden="true">{on ? '✓' : '○'}</span>
              <div>
                <strong className="benefit-title">{b.title}</strong>
                <p className="benefit-text">{b.text}</p>
                <span className="benefit-how">
                  {on ? 'Unlocked' : `Unlocks with ${award?.name ?? 'an award'}${award?.requirement ? `: ${award.requirement}` : ''}`}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
