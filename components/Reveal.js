'use client';
import { useEffect, useRef, useState } from 'react';
import { play } from '../lib/sound';

// Randomized access moment: titles cycle and decelerate, then lock onto the
// real pick with a landing pulse and chime. Runs about 3 seconds.
const STEPS = 20;
const START_MS = 55;
const GROWTH = 1.09;

export default function Reveal({ pool, target, onDone }) {
  const [label, setLabel] = useState('');
  const [landed, setLanded] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let step = 0;
    let delay = START_MS;
    let timer;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      step++;
      if (step >= STEPS) {
        setLabel(target);
        setLanded(true);
        play('land');
        play('success');
        timer = setTimeout(() => doneRef.current?.(), 1000);
        return;
      }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      setLabel(pick ? pick.title : '');
      play('tick');
      delay *= GROWTH;
      timer = setTimeout(tick, delay);
    };

    play('whoosh');
    timer = setTimeout(tick, delay);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className={`reveal ${landed ? 'landed' : ''}`} aria-live="polite">
      <div className="reveal-kicker">{landed ? 'Today' : 'Choosing'}</div>
      <div className="reveal-label" key={label}>{label}</div>
    </div>
  );
}
