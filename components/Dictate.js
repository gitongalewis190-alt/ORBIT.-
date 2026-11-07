'use client';

import { useEffect, useRef, useState } from 'react';
import { autocorrectInput, autocorrectOn } from '../lib/autocorrect';
import { toast } from '../lib/toast';

// Speaks into a text field. The keyboard stays available; this only adds words.
function correct(text) {
  if (!autocorrectOn()) return text;
  let out = '';
  for (const ch of text) {
    const next = out + ch;
    const fixed = autocorrectInput(next, next.length, ch);
    out = fixed.text;
  }
  return out;
}

export default function Dictate({ onText, disabled }) {
  const [on, setOn] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const rec = useRef(null);

  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('orbit.assist') || '{}');
      if (prefs.dictate === false) setAllowed(false);
    } catch {}
  }, []);

  function stop() {
    rec.current?.stop();
    rec.current = null;
    setOn(false);
  }

  function start() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      toast('This phone cannot take dictation in the browser.', 'warn');
      return;
    }
    const session = new SR();
    session.lang = 'en-GB';
    session.interimResults = false;
    session.continuous = true;
    session.onresult = event => {
      let said = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) said += event.results[i][0].transcript;
      }
      const clean = correct(said).trim();
      if (clean) onText(clean);
    };
    session.onerror = () => stop();
    session.onend = () => setOn(false);
    rec.current = session;
    session.start();
    setOn(true);
  }

  if (!allowed) return null;
  return (
    <button
      type="button"
      className="rich-tool"
      aria-pressed={on}
      disabled={disabled}
      onMouseDown={e => e.preventDefault()}
      onClick={() => (on ? stop() : start())}
    >
      {on ? 'Stop' : 'Speak'}
    </button>
  );
}
