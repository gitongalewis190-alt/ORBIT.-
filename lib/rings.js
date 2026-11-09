// Reflect rings. Reflecting is optional. It has its own three rings, so it never closes a Learn ring.
// Learning is the requirement; these rings show what you reflected on, and they count toward awards.
//
// Targets are per day. Change them here; the rings and awards read these values.
export const REFLECT_TARGET = {
  minutes: 10, // minutes spent in reflection
  words: 100,  // words written in reflection
  revisits: 1, // reflections on a topic you had already studied before today
};

// Reflection entries for one day, measured against the Reflect targets.
// earlierTopics: Set of topic ids studied (learned) on days before this one.
export function reflectDay(entries, earlierTopics) {
  const minutes = entries.reduce((t, e) => t + (Number(e.minutes_spent) || 0), 0);
  const words = entries.reduce((t, e) => t + (Number(e.word_count) || 0), 0);
  const revisits = new Set(entries.filter(e => earlierTopics.has(e.topic_id)).map(e => e.topic_id)).size;
  const ring = (value, target) => Math.min(1, value / target);
  const values = {
    minutes: ring(minutes, REFLECT_TARGET.minutes),
    words: ring(words, REFLECT_TARGET.words),
    revisit: ring(revisits, REFLECT_TARGET.revisits),
  };
  return {
    minutes, words, revisits,
    values,
    // A reflect day counts toward the Reflect awards only when all three rings close.
    closed: values.minutes >= 1 && values.words >= 1 && values.revisit >= 1,
    any: entries.length > 0,
  };
}
