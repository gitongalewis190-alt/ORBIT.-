// Benefits are real. Each one is granted by one award, and changes how Orbit behaves.
// The earned list is cached on the phone so screens that render before data loads
// (such as the focus timer) show the right options at once.
export const BENEFITS = {
  freeze_plus: {
    title: 'Second freeze',
    text: 'You can save a streak twice in any seven days.',
    from: 'streak_7',
  },
  deep_focus: {
    title: 'Deep focus preset',
    text: 'A 90 minute preset appears on the focus timer.',
    from: 'focus_10h',
  },
  marathon: {
    title: 'Marathon preset',
    text: 'A 180 minute preset appears on the focus timer.',
    from: 'focus_50h',
  },
  reflection_prompts: {
    title: 'Five more prompts',
    text: 'Reflect mode gains five extra prompts.',
    from: 'reflect_5',
  },
};

export const BENEFIT_CACHE_KEY = 'orbit.benefits';

// Benefit ids granted by a set of earned award keys.
export function benefitsFor(earned) {
  return Object.keys(BENEFITS).filter(id => earned.has(BENEFITS[id].from));
}

export function cacheBenefits(ids) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BENEFIT_CACHE_KEY, JSON.stringify(ids));
}

export function readBenefits() {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(BENEFIT_CACHE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
