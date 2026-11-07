// Damped spring used by the navigation selector. Pure, so it can be tested in Node.
// stiffness and damping give a damping ratio near 0.7: a small overshoot, then it settles.
export const SPRING = { stiffness: 300, damping: 24 };

// One step of a semi-implicit Euler spring. state: { x, v }. Returns the next state.
export function stepSpring(state, target, dt, spring = SPRING) {
  const step = Math.min(dt, 1 / 30); // Never integrate a frame longer than 1/30 s.
  const a = -spring.stiffness * (state.x - target) - spring.damping * state.v;
  const v = state.v + a * step;
  const x = state.x + v * step;
  return { x, v };
}

// True once the spring is at rest on its target.
export function settled(state, target, eps = 0.05) {
  return Math.abs(state.x - target) < eps && Math.abs(state.v) < eps;
}
