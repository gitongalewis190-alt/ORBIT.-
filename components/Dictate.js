'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from '../lib/toast';
import { splitUtterance } from '../lib/dictate';

const PAUSE_MS = 700;

// Speaks into a text field. Phrases are cleaned and committed on a pause
// or on sentence punctuation, not as a raw dump from the recogniser.
export default function Dictate({ onText, disabled }) {
  const [on, setOn] = useState(false);
  const [live, setLive] = useState('');
  const [allowed, setAllowed] = useState(true);
  const rec = useRef(null);
  const want = useRef(false);
  const buffer = useRef('');
  const pause = useRef(0);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('orbit.assist') || '{}');
      if (prefs.dictate === false) setAllowed(false);
    } catch {}
    return () => {
      want.current = false;
      window.clearTimeout(pause.current);
      try { rec.current?.stop(); } catch {}
      rec.current = null;
    };
  }, []);

  function flush(force) {
    window.clearTimeout(pause.current);
    const pending = buffer.current.trim();
    buffer.current = '';
    if (!pending) return;
    const phrases = splitUtterance(pending);
    if (phrases.length) {
      phrases.forEach(phrase => onTextRef.current(phrase));
      return;
    }
    if (force) {
      const fallback = splitUtterance(pending.endsWith('.') ? pending : pending);
      fallback.forEach(phrase => onTextRef.current(phrase));
    }
  }

  function armPause() {
    window.clearTimeout(pause.current);
    pause.current = window.setTimeout(() => flush(true), PAUSE_MS);
  }

  function stop() {
    want.current = false;
    window.clearTimeout(pause.current);
    flush(true);
    try { rec.current?.stop(); } catch {}
    rec.current = null;
    setOn(false);
    setLive('');
  }

  function listen() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      toast('This phone cannot take dictation in the browser.', 'warn');
      want.current = false;
      setOn(false);
      return;
    }
    const session = new SR();
    session.lang = 'en-GB';
    session.interimResults = true;
    session.continuous = true;
    session.onresult = event => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }
      if (finalText) {
        buffer.current = `${buffer.current} ${finalText}`.trim();
        const ready = splitUtterance(buffer.current);
        const ends = /[.!?\n]\s*$/.test(buffer.current);
        if (ends && ready.length) {
          buffer.current = '';
          ready.forEach(phrase => onTextRef.current(phrase));
        } else {
          armPause();
        }
      }
      setLive((interim || buffer.current).trim());
    };
    session.onerror = event => {
      const code = event?.error;
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        want.current = false;
        toast('The microphone is blocked. Allow it, then try Speak again.', 'warn');
        setOn(false);
        setLive('');
      }
    };
    session.onend = () => {
      rec.current = null;
      if (!want.current) {
        setOn(false);
        return;
      }
      // iOS ends the session after each phrase. Keep going until Stop.
      window.setTimeout(() => {
        if (want.current) listen();
      }, 150);
    };
    rec.current = session;
    try {
      session.start();
      setOn(true);
    } catch {
      want.current = false;
      setOn(false);
    }
  }

  function start() {
    if (want.current) return;
    want.current = true;
    buffer.current = '';
    listen();
  }

  if (!allowed) return null;
  return (
    <span className="dictate">
      <button
        type="button"
        className="rich-tool"
        aria-pressed={on}
        disabled={disabled}
        onClick={() => (on ? stop() : start())}
      >
        {on ? 'Listening' : 'Speak'}
      </button>
      {on && live ? (
        <span className="dictate-live muted" aria-live="polite" style={{ display: 'block', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {live}
        </span>
      ) : null}
    </span>
  );
}
