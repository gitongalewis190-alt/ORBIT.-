import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { MESSAGES, layoutMessage, withMoves } from "./glyphs";
const SVG_NS = "http://www.w3.org/2000/svg";
function EnterScreen() {
  const [reduced, setReduced] = useState(false);
  const [line, setLine] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    if (!reduced) return;
    const id = window.setInterval(() => setLine((n) => (n + 1) % MESSAGES.length), 4200);
    return () => window.clearInterval(id);
  }, [reduced]);
  return /* @__PURE__ */ jsx("div", { className: "enter-page", children: reduced ? /* @__PURE__ */ jsx("p", { className: "quiet-line", "aria-live": "polite", children: MESSAGES[line]?.text }) : /* @__PURE__ */ jsx(PebbleInk, {}) });
}
function PebbleInk() {
  const svgRef = useRef(null);
  const inkRef = useRef(null);
  const ballRef = useRef(null);
  useEffect(() => {
    const svg = svgRef.current;
    const ink = inkRef.current;
    const ball = ballRef.current;
    if (!svg || !ink || !ball) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    let msg = 0;
    let phase = "bounce";
    let phaseT = 0;
    let x = 0;
    let y = -30;
    let vx = 160;
    let vy = 0;
    let squash = 0;
    let bounces = 0;
    let segs = [];
    let writeDist = 0;
    let glideFrom = { x: 0, y: 0 };
    let glideTo = { x: 0, y: 0 };
    let totalLen = 1;
    const R = 8;
    const sizeOf = () => {
      const vv = window.visualViewport;
      const w = vv?.width ?? window.innerWidth;
      const full = vv?.height ?? window.innerHeight;
      const h = Math.max(220, full * 0.4);
      return { w, h };
    };
    const mountMessage = (index) => {
      const { w, h } = sizeOf();
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      ink.replaceChildren();
      const message = MESSAGES[index % MESSAGES.length];
      const maxW = Math.min(w - 56, 560);
      let size = message.size;
      let draft = layoutMessage(message.text, size, maxW, w / 2, 0);
      const span = (list) => {
        let minY = Infinity;
        let maxY = -Infinity;
        for (const s of list) {
          minY = Math.min(minY, s.y0, s.y1);
          maxY = Math.max(maxY, s.y0, s.y1);
        }
        return { minY, maxY };
      };
      let box = span(draft);
      while (draft.length && box.maxY - box.minY > h * 0.46 && size > 18) {
        size *= 0.88;
        draft = layoutMessage(message.text, size, maxW, w / 2, 0);
        box = span(draft);
      }
      const top = (h - (box.maxY - box.minY)) / 2 - box.minY;
      const laid = withMoves(layoutMessage(message.text, size, maxW, w / 2, top));
      segs = laid.map((seg) => {
        if (seg.move) {
          return { ...seg, len: Math.max(1, Math.hypot(seg.x1 - seg.x0, seg.y1 - seg.y0)) };
        }
        if (seg.dot) {
          const c = document.createElementNS(SVG_NS, "circle");
          c.setAttribute("cx", String(seg.x0));
          c.setAttribute("cy", String(seg.y0));
          c.setAttribute("r", String(Math.max(1.7, size * 0.045)));
          c.setAttribute("fill", "var(--color-ink)");
          c.style.opacity = "0";
          ink.appendChild(c);
          return { ...seg, el: c, len: 16 };
        }
        const p = document.createElementNS(SVG_NS, "path");
        p.setAttribute("d", seg.d);
        p.setAttribute("class", "ink-live");
        ink.appendChild(p);
        const len = Math.max(1, p.getTotalLength());
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len}`;
        return { ...seg, el: p, len };
      });
      totalLen = segs.reduce((sum, s) => sum + s.len, 0) || 1;
      writeDist = 0;
      if (segs[0]) {
        glideTo = { x: segs[0].x0, y: segs[0].y0 };
      }
    };
    const pointAt = (dist) => {
      let left = dist;
      for (const seg of segs) {
        if (left > seg.len) {
          left -= seg.len;
          continue;
        }
        const t = seg.len === 0 ? 1 : clamp01(left / seg.len);
        if (seg.move || seg.dot || !(seg.el instanceof SVGPathElement)) {
          return { x: seg.x0 + (seg.x1 - seg.x0) * t, y: seg.y0 + (seg.y1 - seg.y0) * t };
        }
        const pt = seg.el.getPointAtLength(t * seg.len);
        return { x: pt.x, y: pt.y };
      }
      const lastSeg = segs[segs.length - 1];
      return lastSeg ? { x: lastSeg.x1, y: lastSeg.y1 } : { x, y };
    };
    const paintWrite = (dist) => {
      let left = dist;
      for (const seg of segs) {
        if (seg.move) {
          left -= seg.len;
          continue;
        }
        if (seg.dot && seg.el) {
          seg.el.style.opacity = left >= seg.len * 0.5 ? "1" : "0";
        } else if (seg.el instanceof SVGPathElement) {
          const shown = clamp01(left / seg.len);
          seg.el.style.strokeDashoffset = `${seg.len * (1 - shown)}`;
        }
        left -= seg.len;
      }
    };
    const fadeInk = (opacity) => {
      ink.style.opacity = String(opacity);
    };
    mountMessage(0);
    const { w: w0 } = sizeOf();
    x = w0 * 0.5;
    y = -20;
    vx = w0 > 0 ? 180 : 140;
    const frame = (now) => {
      const dt = Math.min(0.033, (now - last) / 1e3);
      last = now;
      const { w, h } = sizeOf();
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      phaseT += dt;
      const floor = h - R - 18;
      const ceil = R + 18;
      if (phase === "bounce") {
        fadeInk(0);
        vy += 2700 * dt;
        x += vx * dt;
        y += vy * dt;
        squash *= Math.exp(-8 * dt);
        if (x < R + 12) {
          x = R + 12;
          vx = Math.abs(vx) * 0.82;
        }
        if (x > w - R - 12) {
          x = w - R - 12;
          vx = -Math.abs(vx) * 0.82;
        }
        if (y > floor) {
          y = floor;
          squash = Math.max(squash, clamp01(Math.abs(vy) / 1400));
          vy = -Math.abs(vy) * Math.max(0.45, 0.78 - bounces * 0.04);
          vx *= 0.94;
          bounces += 1;
        }
        if (y < ceil) {
          y = ceil;
          vy = Math.abs(vy) * 0.8;
        }
        if (bounces >= 7 && Math.hypot(vx, vy) < 220 || phaseT > 7.2) {
          phase = "glide";
          phaseT = 0;
          glideFrom = { x, y };
          mountMessage(msg);
        }
      } else if (phase === "glide") {
        const t = clamp01(phaseT / 0.85);
        const e = t * t * (3 - 2 * t);
        const cx = (glideFrom.x + glideTo.x) / 2;
        const cy = Math.min(glideFrom.y, glideTo.y) - 80;
        const u = 1 - e;
        x = u * u * glideFrom.x + 2 * u * e * cx + e * e * glideTo.x;
        y = u * u * glideFrom.y + 2 * u * e * cy + e * e * glideTo.y;
        if (t >= 1) {
          phase = "write";
          phaseT = 0;
          writeDist = 0;
          fadeInk(1);
        }
      } else if (phase === "write") {
        writeDist += dt * 220;
        paintWrite(writeDist);
        const pt = pointAt(writeDist);
        x = pt.x;
        y = pt.y;
        if (writeDist >= totalLen) {
          phase = "hold";
          phaseT = 0;
        }
      } else if (phase === "hold") {
        paintWrite(totalLen);
        if (phaseT > 2.3) {
          phase = "fade";
          phaseT = 0;
        }
      } else if (phase === "fade") {
        fadeInk(1 - clamp01(phaseT / 0.55));
        if (phaseT > 0.55) {
          msg = (msg + 1) % MESSAGES.length;
          phase = "bounce";
          phaseT = 0;
          bounces = 0;
          squash = 0;
          fadeInk(0);
          ink.replaceChildren();
          segs = [];
          vx = (Math.random() > 0.5 ? 1 : -1) * (140 + Math.random() * 120);
          vy = -520;
          y = Math.min(y, h * 0.3);
        }
      }
      const fall = clamp01(vy / 1800);
      const sx = 1 + squash * 0.45 - fall * 0.18;
      const sy = Math.max(0.55, 1 - squash * 0.35 + fall * 0.2);
      ball.setAttribute("cx", String(x));
      ball.setAttribute("cy", String(y));
      ball.setAttribute("transform", `translate(${x} ${y}) scale(${sx} ${sy}) translate(${-x} ${-y})`);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return /* @__PURE__ */ jsxs("svg", { ref: svgRef, className: "ink-layer", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("g", { ref: inkRef }),
    /* @__PURE__ */ jsx("circle", { ref: ballRef, className: "pebble", r: "8", cx: "-20", cy: "-20", strokeWidth: 1.6 })
  ] });
}
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
export {
  EnterScreen,
  PebbleInk
};
