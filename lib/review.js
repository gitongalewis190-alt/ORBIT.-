import { addDays, today } from './dates';

// SM-2 spaced repetition. quality is your confidence, 0 to 5.
// Below 3 means the topic needs relearning tomorrow.
export function nextReview(state, quality) {
  let ease = Number(state.ease ?? 2.5);
  let reps = Number(state.reps ?? 0);
  let interval = Number(state.interval_days ?? 1);

  if (quality < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ease);
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  }

  return {
    ease: Number(ease.toFixed(2)),
    reps,
    interval_days: interval,
    due_on: addDays(today(), interval),
  };
}
