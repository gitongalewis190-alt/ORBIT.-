import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import {
  ANCHOR,
  BRAIN_D,
  WALKER,
  bookInk,
  brainDetailInk,
  brainLineInk,
  knowledgeInk
} from "./art";
const BOOK_DRAW = 4.4;
const BOOK_HOLD = 3.6;
const UNWIND = 3.4;
const KNOW_HOLD = 3.5;
const BRAIN = 4.2;
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function ease(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}
function freshWorld() {
  return {
    mode: "physics",
    t: 0,
    x: 500,
    y: 28,
    vx: 70,
    vy: 0,
    squash: 0,
    bounces: 0,
    stretch: 0,
    book: 0,
    knowledge: 0,
    outline: 0,
    fill: 0,
    detail: 0,
    ampBook: 0,
    ampKnow: 0,
    ampBrain: 0
  };
}
function InkPaths({ items, scene }) {
  return items.map((p, i) => /* @__PURE__ */ jsx(
    "path",
    {
      className: p.wide ? "ink ink-road" : p.cream ? "ink ink-cream" : "ink",
      "data-ink": scene,
      "data-from": p.from,
      "data-to": p.to,
      d: p.d
    },
    `${scene}-${i}`
  ));
}
function bySlot(items, slot) {
  return items.filter((p) => p.slot === slot);
}
function OrbitLanding({ onBegin }) {
  const svgRef = useRef(null);
  const pebbleRef = useRef(null);
  const bookPenRef = useRef(null);
  const knowPenRef = useRef(null);
  const brainPenRef = useRef(null);
  const bookRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const personRef = useRef(null);
  const headRef = useRef(null);
  const knowRef = useRef(null);
  const loopsRef = useRef(null);
  const raysRef = useRef(null);
  const bookLRef = useRef(null);
  const bookRRef = useRef(null);
  const brainFillRef = useRef(null);
  const portalRef = useRef(null);
  const outlineRef = useRef(null);
  const outerFigRef = useRef(null);
  const innerFigRef = useRef(null);
  const plantRef = useRef(null);
  const worldRef = useRef(freshWorld());
  const settledRef = useRef(false);
  const holdingRef = useRef(false);
  const speedRef = useRef(1);
  const pathsRef = useRef({
    book: [],
    knowledge: [],
    brainline: [],
    detail: []
  });
  const [phase, setPhase] = useState("play");
  const [holding, setHolding] = useState(false);
  const [runId, setRunId] = useState(0);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const collect = (scene) => [...svg.querySelectorAll(`[data-ink="${scene}"]`)].map((el) => ({
      el,
      from: Number(el.dataset.from ?? 0),
      to: Number(el.dataset.to ?? 1),
      len: Math.max(1, el.getTotalLength())
    }));
    pathsRef.current = {
      book: collect("book"),
      knowledge: collect("knowledge"),
      brainline: collect("brainline"),
      detail: collect("detail")
    };
    const pebble = pebbleRef.current;
    const bookPen = bookPenRef.current;
    const knowPen = knowPenRef.current;
    const brainPen = brainPenRef.current;
    const revealScene = (scene, amount) => {
      for (const p of pathsRef.current[scene]) {
        const span = Math.max(1e-4, p.to - p.from);
        const local = clamp((amount - p.from) / span, 0, 1);
        p.el.style.strokeDasharray = `${p.len}`;
        p.el.style.strokeDashoffset = `${p.len * (1 - local)}`;
      }
    };
    const placePen = (scene, amount, pen) => {
      if (!pen) return;
      let best = null;
      for (const p of pathsRef.current[scene]) {
        const span = Math.max(1e-4, p.to - p.from);
        const local = (amount - p.from) / span;
        if (local > 0.02 && local < 0.995 && (!best || p.from >= best.p.from)) {
          best = { p, local };
        }
      }
      if (!best) {
        pen.style.opacity = "0";
        return;
      }
      const pt = best.p.el.getPointAtLength(best.local * best.p.len);
      pen.setAttribute("cx", String(pt.x));
      pen.setAttribute("cy", String(pt.y));
      pen.style.opacity = "1";
    };
    const paint = (w, now) => {
      revealScene("book", w.book);
      revealScene("knowledge", w.knowledge);
      revealScene("brainline", w.outline);
      revealScene("detail", w.detail);
      if (brainFillRef.current) brainFillRef.current.style.opacity = String(w.fill);
      if (portalRef.current) portalRef.current.style.opacity = String(clamp((w.detail - 0.02) / 0.28, 0, 1));
      if (outlineRef.current) outlineRef.current.style.opacity = String(1 - w.fill);
      if (outerFigRef.current) outerFigRef.current.style.opacity = String(clamp((w.detail - 0.25) / 0.45, 0, 1));
      if (innerFigRef.current) innerFigRef.current.style.opacity = String(clamp((w.detail - 0.4) / 0.4, 0, 1));
      const sec = now / 1e3;
      if (bookRef.current) {
        const lift = Math.sin(sec * 1.15) * 12 * w.ampBook;
        bookRef.current.setAttribute("transform", `translate(0 ${lift})`);
      }
      if (leftRef.current) {
        leftRef.current.setAttribute("transform", `rotate(${-Math.sin(sec * 1.65) * 2.6 * w.ampBook} 468 560)`);
      }
      if (rightRef.current) {
        rightRef.current.setAttribute("transform", `rotate(${Math.sin(sec * 1.65) * 2.2 * w.ampBook} 620 540)`);
      }
      if (personRef.current) {
        const lean = Math.sin(sec * 1.15 + 0.4) * 1.6 * w.ampBook;
        personRef.current.setAttribute("transform", `rotate(${lean} 430 400)`);
      }
      if (headRef.current) {
        const nod = Math.sin(sec * 0.85) * 5 * w.ampBook;
        headRef.current.setAttribute("transform", `rotate(${nod} 450 280)`);
      }
      if (loopsRef.current) {
        loopsRef.current.setAttribute(
          "transform",
          `translate(${Math.sin(sec * 0.6) * 7 * w.ampKnow} ${Math.cos(sec * 0.45) * 4 * w.ampKnow})`
        );
      }
      if (raysRef.current) {
        const pulse = w.knowledge > 0.2 ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(sec * 2.4)) : 1;
        raysRef.current.style.opacity = String(pulse);
      }
      if (bookLRef.current) {
        bookLRef.current.setAttribute("transform", `rotate(${-Math.sin(sec * 1.4) * 1.4 * w.ampKnow} 360 560)`);
      }
      if (bookRRef.current) {
        bookRRef.current.setAttribute("transform", `rotate(${Math.sin(sec * 1.4) * 1.4 * w.ampKnow} 620 560)`);
      }
      if (outerFigRef.current) {
        outerFigRef.current.setAttribute("transform", `translate(0 ${Math.sin(sec * 1.2) * 2.2 * w.ampBrain})`);
      }
      if (innerFigRef.current) {
        innerFigRef.current.setAttribute("transform", `translate(0 ${Math.sin(sec * 1.05 + 1) * 1.4 * w.ampBrain})`);
      }
      if (plantRef.current) {
        plantRef.current.setAttribute("transform", `rotate(${Math.sin(sec * 0.8) * 2.4 * w.ampBrain} 868 340)`);
      }
      if (pebble) {
        const fall = clamp(w.vy / 2e3, 0, 1);
        const sx = (1 + w.squash * 0.55 - fall * 0.22) * (1 + w.stretch * 2.6);
        const sy = Math.max(0.18, (1 - w.squash * 0.42 + fall * 0.28) * (1 - w.stretch * 0.62));
        const rot = clamp(w.vx * 0.03, -16, 16);
        pebble.setAttribute("cx", String(w.x));
        pebble.setAttribute("cy", String(w.y));
        pebble.setAttribute(
          "transform",
          `translate(${w.x} ${w.y}) rotate(${rot}) scale(${sx} ${sy}) translate(${-w.x} ${-w.y})`
        );
        pebble.style.opacity = w.mode === "physics" ? "1" : "0";
      }
      if (w.mode === "bookDraw") placePen("book", w.book, bookPen);
      else if (bookPen) bookPen.style.opacity = "0";
      if (w.mode === "unwind" && w.knowledge > 0.02 && w.knowledge < 0.99) placePen("knowledge", w.knowledge, knowPen);
      else if (knowPen) knowPen.style.opacity = "0";
      if (w.mode === "brain" && w.outline > 0.02 && w.outline < 0.98 && w.fill < 0.4) {
        placePen("brainline", w.outline, brainPen);
      } else if (brainPen) brainPen.style.opacity = "0";
    };
    const finish = (w) => {
      w.mode = "brain";
      w.book = 0;
      w.knowledge = 0;
      w.outline = 1;
      w.fill = 1;
      w.detail = 1;
      w.stretch = 0;
      w.ampBook = 0;
      w.ampKnow = 0;
      w.ampBrain = 1;
      paint(w, performance.now());
    };
    if (reduced) {
      const w = worldRef.current;
      settledRef.current = true;
      finish(w);
      setPhase("done");
      let raf2 = 0;
      const idle = (now) => {
        paint(worldRef.current, now);
        raf2 = requestAnimationFrame(idle);
      };
      raf2 = requestAnimationFrame(idle);
      return () => cancelAnimationFrame(raf2);
    }
    worldRef.current = freshWorld();
    settledRef.current = false;
    let last = performance.now();
    let raf = 0;
    let notified = false;
    const step = (w, dt) => {
      w.t += dt;
      if (w.mode === "physics") {
        w.vy += 2500 * dt;
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        w.squash *= Math.exp(-7 * dt);
        if (w.x < 80) {
          w.x = 80;
          w.vx = Math.abs(w.vx) * 0.72;
        }
        if (w.x > 920) {
          w.x = 920;
          w.vx = -Math.abs(w.vx) * 0.72;
        }
        if (w.y > ANCHOR.y) {
          w.y = ANCHOR.y;
          const impact = clamp(Math.abs(w.vy) / 1600, 0, 1);
          w.squash = Math.max(w.squash, impact);
          const rest = Math.max(0.22, 0.64 - w.bounces * 0.07);
          w.vy = -Math.abs(w.vy) * rest;
          w.vx *= 0.86;
          w.bounces += 1;
        }
        if (w.bounces >= 3) {
          w.x += (ANCHOR.x - w.x) * Math.min(1, dt * 3.2);
          w.vx *= Math.exp(-2.4 * dt);
        }
        const energy = Math.hypot(w.vx, w.vy);
        w.stretch = w.bounces >= 4 ? clamp((420 - energy) / 420, 0, 1) : 0;
        w.book = w.stretch * 0.08;
        const settled = w.bounces >= 4 && energy < 90 && w.stretch > 0.92;
        if (settled || w.t > 6.4) {
          w.mode = "bookDraw";
          w.t = 0;
          w.book = Math.max(w.book, 0.02);
        }
        return;
      }
      if (w.mode === "bookDraw") {
        w.book = clamp(w.t / BOOK_DRAW, 0, 1);
        w.ampBook = 0;
        if (w.t >= BOOK_DRAW) {
          w.mode = "bookHold";
          w.t = 0;
          w.book = 1;
        }
        return;
      }
      if (w.mode === "bookHold") {
        w.book = 1;
        w.ampBook += (1 - w.ampBook) * Math.min(1, dt * 2.5);
        if (w.t >= BOOK_HOLD) {
          w.mode = "unwind";
          w.t = 0;
        }
        return;
      }
      if (w.mode === "unwind") {
        const u = clamp(w.t / UNWIND, 0, 1);
        w.book = u < 0.1 ? 1 : u > 0.62 ? 0 : 1 - ease((u - 0.1) / 0.52);
        w.knowledge = u < 0.28 ? 0 : ease(clamp((u - 0.28) / 0.66, 0, 1));
        w.ampBook += ((u < 0.4 ? 1 : 0) - w.ampBook) * Math.min(1, dt * 3);
        w.ampKnow += (0 - w.ampKnow) * Math.min(1, dt * 3);
        if (w.t >= UNWIND) {
          w.mode = "knowHold";
          w.t = 0;
          w.book = 0;
          w.knowledge = 1;
        }
        return;
      }
      if (w.mode === "knowHold") {
        w.knowledge = 1;
        w.book = 0;
        w.ampKnow += (1 - w.ampKnow) * Math.min(1, dt * 2.2);
        if (w.t >= KNOW_HOLD) {
          w.mode = "brain";
          w.t = 0;
        }
        return;
      }
      const b = clamp(w.t / BRAIN, 0, 1);
      w.knowledge = b < 0.06 ? 1 : b > 0.42 ? 0 : 1 - ease((b - 0.06) / 0.36);
      w.outline = b < 0.18 ? 0 : ease(clamp((b - 0.18) / 0.36, 0, 1));
      w.fill = b < 0.4 ? 0 : ease(clamp((b - 0.4) / 0.18, 0, 1));
      w.detail = b < 0.6 ? 0 : ease(clamp((b - 0.6) / 0.36, 0, 1));
      w.ampKnow += ((b < 0.2 ? 1 : 0) - w.ampKnow) * Math.min(1, dt * 3);
      w.ampBrain += ((w.detail > 0.65 ? 1 : 0) - w.ampBrain) * Math.min(1, dt * 2);
      if (w.t >= BRAIN && !notified) {
        notified = true;
        settledRef.current = true;
        w.knowledge = 0;
        w.book = 0;
        w.outline = 1;
        w.fill = 1;
        w.detail = 1;
        w.ampBrain = 1;
        setPhase("done");
      }
    };
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1e3);
      last = now;
      const w = worldRef.current;
      if (!settledRef.current) {
        const target = holdingRef.current ? 5 : 1;
        speedRef.current += (target - speedRef.current) * (1 - Math.exp(-dt * 5));
        const scaled = dt * speedRef.current;
        let leftDt = scaled;
        while (leftDt > 0) {
          const h = Math.min(leftDt, 1 / 90);
          step(w, h);
          leftDt -= h;
          if (settledRef.current) break;
        }
      }
      paint(w, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [runId]);
  const skip = () => {
    const w = worldRef.current;
    settledRef.current = true;
    holdingRef.current = false;
    setHolding(false);
    w.book = 0;
    w.knowledge = 0;
    w.outline = 1;
    w.fill = 1;
    w.detail = 1;
    w.ampBook = 0;
    w.ampKnow = 0;
    w.ampBrain = 1;
    w.mode = "brain";
    setPhase("done");
  };
  const replay = () => {
    worldRef.current = freshWorld();
    settledRef.current = false;
    speedRef.current = 1;
    holdingRef.current = false;
    setHolding(false);
    setPhase("play");
    setRunId((n) => n + 1);
  };
  const onDown = (e) => {
    if (settledRef.current) return;
    if (e.target.closest("button")) return;
    holdingRef.current = true;
    setHolding(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onUp = () => {
    holdingRef.current = false;
    setHolding(false);
  };
  return /* @__PURE__ */ jsxs(
    "section",
    {
      className: "stage",
      onPointerDown: onDown,
      onPointerUp: onUp,
      onPointerCancel: onUp,
      onContextMenu: (e) => e.preventDefault(),
      children: [
        /* @__PURE__ */ jsx("p", { className: "sr-only", children: "Orbit. Knowledge is power. An introduction draws itself, then invites you to begin." }),
        phase === "play" && /* @__PURE__ */ jsx("button", { type: "button", className: "skip", onClick: skip, children: "Skip" }),
        phase === "play" && /* @__PURE__ */ jsx("p", { className: "hold-hint", children: holding ? "Release to ease" : "Hold to hasten" }),
        /* @__PURE__ */ jsx("div", { className: "stage-art", children: /* @__PURE__ */ jsxs("svg", { ref: svgRef, viewBox: "0 0 1000 1000", preserveAspectRatio: "xMidYMid meet", "aria-hidden": "true", children: [
          /* @__PURE__ */ jsxs("g", { ref: bookRef, children: [
            /* @__PURE__ */ jsxs("g", { children: [
              /* @__PURE__ */ jsx(InkPaths, { items: bySlot(bookInk, "tail"), scene: "book" }),
              /* @__PURE__ */ jsx(InkPaths, { items: bySlot(bookInk, "spine"), scene: "book" })
            ] }),
            /* @__PURE__ */ jsx("g", { ref: leftRef, children: /* @__PURE__ */ jsx(InkPaths, { items: bySlot(bookInk, "left"), scene: "book" }) }),
            /* @__PURE__ */ jsx("g", { ref: rightRef, children: /* @__PURE__ */ jsx(InkPaths, { items: bySlot(bookInk, "right"), scene: "book" }) }),
            /* @__PURE__ */ jsxs("g", { ref: personRef, children: [
              /* @__PURE__ */ jsx(InkPaths, { items: bySlot(bookInk, "person"), scene: "book" }),
              /* @__PURE__ */ jsx("g", { ref: headRef, children: /* @__PURE__ */ jsx(InkPaths, { items: bySlot(bookInk, "head"), scene: "book" }) })
            ] }),
            /* @__PURE__ */ jsx("circle", { ref: bookPenRef, className: "pen", r: "8", cx: "500", cy: "900" })
          ] }),
          /* @__PURE__ */ jsxs("g", { ref: knowRef, children: [
            /* @__PURE__ */ jsx("g", { ref: loopsRef, children: /* @__PURE__ */ jsx(InkPaths, { items: bySlot(knowledgeInk, "loops"), scene: "knowledge" }) }),
            /* @__PURE__ */ jsx("g", { ref: raysRef, children: /* @__PURE__ */ jsx(InkPaths, { items: bySlot(knowledgeInk, "rays"), scene: "knowledge" }) }),
            /* @__PURE__ */ jsx(InkPaths, { items: bySlot(knowledgeInk, "main"), scene: "knowledge" }),
            /* @__PURE__ */ jsx("g", { ref: bookLRef, children: /* @__PURE__ */ jsx(InkPaths, { items: bySlot(knowledgeInk, "bookL"), scene: "knowledge" }) }),
            /* @__PURE__ */ jsx("g", { ref: bookRRef, children: /* @__PURE__ */ jsx(InkPaths, { items: bySlot(knowledgeInk, "bookR"), scene: "knowledge" }) }),
            /* @__PURE__ */ jsx("circle", { ref: knowPenRef, className: "pen", r: "8", cx: "140", cy: "280" })
          ] }),
          /* @__PURE__ */ jsxs("g", { children: [
            /* @__PURE__ */ jsx("path", { ref: brainFillRef, className: "brain-fill", d: BRAIN_D }),
            /* @__PURE__ */ jsx("g", { ref: outlineRef, children: /* @__PURE__ */ jsx(InkPaths, { items: brainLineInk, scene: "brainline" }) }),
            /* @__PURE__ */ jsx("circle", { ref: portalRef, className: "portal", cx: "500", cy: "300", r: "68" }),
            /* @__PURE__ */ jsx(InkPaths, { items: bySlot(brainDetailInk, "road"), scene: "detail" }),
            /* @__PURE__ */ jsx(InkPaths, { items: bySlot(brainDetailInk, "sulci"), scene: "detail" }),
            /* @__PURE__ */ jsx("g", { transform: "translate(500 835) scale(1.45) translate(-20 -110)", children: /* @__PURE__ */ jsx("g", { ref: outerFigRef, className: "figure", children: /* @__PURE__ */ jsx("path", { d: WALKER, fill: "currentColor" }) }) }),
            /* @__PURE__ */ jsx("g", { transform: "translate(500 330) scale(0.48) translate(-20 -80)", children: /* @__PURE__ */ jsx("g", { ref: innerFigRef, className: "figure", children: /* @__PURE__ */ jsx("path", { d: WALKER, fill: "currentColor" }) }) }),
            /* @__PURE__ */ jsx(InkPaths, { items: bySlot(brainDetailInk, "icons"), scene: "detail" }),
            /* @__PURE__ */ jsx("g", { ref: plantRef, children: /* @__PURE__ */ jsx(InkPaths, { items: bySlot(brainDetailInk, "plant"), scene: "detail" }) }),
            /* @__PURE__ */ jsx("circle", { ref: brainPenRef, className: "pen", r: "8", cx: "500", cy: "176" })
          ] }),
          /* @__PURE__ */ jsx("circle", { ref: pebbleRef, className: "pebble", r: "26", cx: "500", cy: "28" })
        ] }) }),
        /* @__PURE__ */ jsxs("footer", { className: "finale", "data-show": phase === "done" ? "true" : "false", "aria-hidden": phase !== "done", children: [
          /* @__PURE__ */ jsx("h1", { className: "wordmark", children: "ORBIT" }),
          /* @__PURE__ */ jsx("p", { className: "tagline", children: "Knowledge is power." }),
          /* @__PURE__ */ jsx("hr", { className: "rule" }),
          /* @__PURE__ */ jsx("p", { className: "support", children: "Flourishing is a practice \u2014 curiosity, attention, and the will to continue." }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "journey", onClick: onBegin, children: "Begin your journey" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "ghost", onClick: replay, children: "Watch again" })
        ] })
      ]
    }
  );
}
export {
  OrbitLanding
};
