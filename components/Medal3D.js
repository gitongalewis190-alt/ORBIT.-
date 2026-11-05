'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Metal finishes. Roughness and metalness are chosen so each reads as its metal.
const METAL = {
  bronze: { color: 0xc07a45, roughness: 0.32, metalness: 1 },
  silver: { color: 0xdfe2e8, roughness: 0.2, metalness: 1 },
  gold: { color: 0xf3c764, roughness: 0.17, metalness: 1 },
  platinum: { color: 0xeef2f7, roughness: 0.1, metalness: 1 },
  obsidian: { color: 0x202026, roughness: 0.12, metalness: 0.85 },
};
const LOCKED = { color: 0x73757d, roughness: 0.62, metalness: 0.35 };

// Back-face palettes: a radial gradient, an ink colour for lettering, and an outer ring.
const BACK = {
  bronze: { a: '#f0c09a', b: '#8c5230', ink: '#2b1d14' },
  silver: { a: '#ffffff', b: '#8d929b', ink: '#23252b' },
  gold: { a: '#fff0b8', b: '#a67a2a', ink: '#2e2410' },
  platinum: { a: '#ffffff', b: '#7a8aa3', ink: '#1f2632' },
  obsidian: { a: '#4b4c57', b: '#0c0c10', ink: '#f2efe9' },
  locked: { a: '#b3b5bb', b: '#4f5159', ink: '#f2efe9' },
};
const TIER_NAME = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', obsidian: 'Obsidian' };

// Emblem outlines, centred on the origin, about 0.9 units across.
function emblemShape(kind) {
  const s = new THREE.Shape();
  const hole = (r, x = 0, y = 0) => {
    const h = new THREE.Path();
    h.absarc(x, y, r, 0, Math.PI * 2, true);
    s.holes.push(h);
  };
  switch (kind) {
    case 'star': {
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.44 : 0.19;
        const a = Math.PI / 2 + (i * Math.PI) / 5;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      s.closePath();
      return s;
    }
    case 'flame': {
      s.moveTo(0, -0.45);
      s.bezierCurveTo(0.28, -0.2, 0.42, 0.05, 0.3, 0.25);
      s.bezierCurveTo(0.2, 0.42, -0.2, 0.42, -0.3, 0.25);
      s.bezierCurveTo(-0.42, 0.05, -0.28, -0.2, -0.08, -0.12);
      s.bezierCurveTo(-0.04, -0.2, -0.02, -0.3, 0, -0.45);
      return s;
    }
    case 'nib': {
      s.moveTo(-0.3, 0.35);
      s.lineTo(0, -0.45);
      s.lineTo(0.3, 0.35);
      s.quadraticCurveTo(0, 0.5, -0.3, 0.35);
      hole(0.07, 0, 0.12);
      return s;
    }
    case 'book': {
      s.moveTo(-0.45, -0.3);
      s.quadraticCurveTo(-0.15, -0.2, 0, -0.3);
      s.quadraticCurveTo(0.15, -0.2, 0.45, -0.3);
      s.lineTo(0.45, 0.3);
      s.quadraticCurveTo(0.15, 0.2, 0, 0.3);
      s.quadraticCurveTo(-0.15, 0.2, -0.45, 0.3);
      s.closePath();
      return s;
    }
    case 'loop': {
      // A thick arc, like a cycle arrow, drawn as an outline with a gap.
      const steps = 40;
      const a0 = 0.4;
      const a1 = 5.4;
      for (let i = 0; i <= steps; i++) {
        const a = a0 + ((a1 - a0) * i) / steps;
        const x = Math.cos(a) * 0.4;
        const y = Math.sin(a) * 0.4;
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      for (let i = steps; i >= 0; i--) {
        const a = a0 + ((a1 - a0) * i) / steps;
        s.lineTo(Math.cos(a) * 0.27, Math.sin(a) * 0.27);
      }
      s.closePath();
      return s;
    }
    case 'compass': {
      s.moveTo(0, 0.45);
      s.lineTo(0.3, 0);
      s.lineTo(0, -0.45);
      s.lineTo(-0.3, 0);
      s.closePath();
      hole(0.06);
      return s;
    }
    case 'clock':
    default: {
      s.absarc(0, 0, 0.42, 0, Math.PI * 2, false);
      hole(0.32);
      return s;
    }
  }
}

// The engraved back: name, tier, and the date earned or the word Locked.
function makeBackCanvas({ name, tier, sub, locked }) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  const pal = locked ? BACK.locked : (BACK[tier] ?? BACK.bronze);

  const grad = g.createRadialGradient(190, 160, 30, 256, 256, 320);
  grad.addColorStop(0, pal.a);
  grad.addColorStop(1, pal.b);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);

  g.strokeStyle = pal.ink;
  g.globalAlpha = 0.35;
  g.lineWidth = 10;
  g.beginPath();
  g.arc(256, 256, 232, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;

  g.fillStyle = pal.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 26px -apple-system, Helvetica, Arial, sans-serif';
  g.fillText('O R B I T', 256, 112);

  let size = 56;
  g.font = `700 ${size}px -apple-system, Helvetica, Arial, sans-serif`;
  while (g.measureText(name).width > 380 && size > 26) {
    size -= 2;
    g.font = `700 ${size}px -apple-system, Helvetica, Arial, sans-serif`;
  }
  g.fillText(name, 256, 262);

  g.font = '600 24px -apple-system, Helvetica, Arial, sans-serif';
  g.fillText(locked ? 'LOCKED' : (TIER_NAME[tier] ?? '').toUpperCase(), 256, 326);

  g.font = '500 22px -apple-system, Helvetica, Arial, sans-serif';
  g.fillText(sub, 256, 384);
  return c;
}

export default function Medal3D({
  tier = 'bronze',
  emblem = 'star',
  name = '',
  dateLabel = '',
  locked = false,
  size = 180,
  interactive = true,
  autoSpin = true,
  intro = false,
}) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof window === 'undefined') return undefined;

    let teardown = null;

    // Builds the scene only while the medal is on screen, so a long list of
    // medals never holds more WebGL contexts than iPhone Safari allows.
    const mount = () => {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      const canvas = document.createElement('canvas');
      canvas.className = 'medal-canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${name} medal, ${TIER_NAME[tier] ?? tier}${locked ? ', locked' : ''}`);
      canvas.style.width = '100%';
      canvas.style.maxWidth = `${size}px`;
      canvas.style.height = 'auto';
      canvas.style.aspectRatio = '1 / 1';
      if (interactive) canvas.style.touchAction = 'none';
      host.appendChild(canvas);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(size, size, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();

      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(3, 4, 6);
      scene.add(key);

      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
      camera.position.set(0, 0.05, 5.8);
      camera.lookAt(0, -0.05, 0);

      const group = new THREE.Group();
      group.position.y = -0.1;
      scene.add(group);

      const geometries = [];
      const materials = [];
      const textures = [];
      const keep = (obj, list) => {
        list.push(obj);
        return obj;
      };

      const style = locked ? LOCKED : (METAL[tier] ?? METAL.bronze);
      const metal = keep(new THREE.MeshStandardMaterial({
        color: style.color, roughness: style.roughness, metalness: style.metalness,
      }), materials);
      const emblemMat = keep(new THREE.MeshStandardMaterial({
        color: style.color, roughness: Math.min(0.9, style.roughness + 0.08), metalness: style.metalness,
      }), materials);

      // Solid body: a disc with bevelled edges, so it has real thickness.
      const depth = 0.14;
      const bevelT = 0.06;
      const bodyShape = new THREE.Shape();
      bodyShape.absarc(0, 0, 1, 0, Math.PI * 2, false);
      const bodyGeo = keep(new THREE.ExtrudeGeometry(bodyShape, {
        depth, bevelEnabled: true, bevelThickness: bevelT, bevelSize: 0.05, bevelSegments: 6, curveSegments: 72,
      }), geometries);
      bodyGeo.translate(0, 0, -depth / 2);
      group.add(new THREE.Mesh(bodyGeo, metal));

      // Raised rims on both faces.
      const rimGeo = keep(new THREE.TorusGeometry(0.9, 0.028, 18, 120), geometries);
      const rimFront = new THREE.Mesh(rimGeo, metal);
      rimFront.position.z = depth / 2 + bevelT - 0.01;
      group.add(rimFront);
      const rimBack = new THREE.Mesh(rimGeo, metal);
      rimBack.position.z = -(depth / 2 + bevelT - 0.01);
      group.add(rimBack);

      // Raised emblem on the front face.
      const emblemGeo = keep(new THREE.ExtrudeGeometry(emblemShape(emblem), {
        depth: 0.05, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.014, bevelSegments: 3, curveSegments: 40,
      }), geometries);
      emblemGeo.translate(0, 0.02, depth / 2 + bevelT - 0.01);
      group.add(new THREE.Mesh(emblemGeo, emblemMat));

      // Hanging loop at the top.
      const hangerGeo = keep(new THREE.TorusGeometry(0.2, 0.05, 20, 64), geometries);
      const hanger = new THREE.Mesh(hangerGeo, metal);
      hanger.position.set(0, 1.13, 0);
      group.add(hanger);

      // Engraved back: a separate face with its own lettering.
      const backTex = keep(new THREE.CanvasTexture(makeBackCanvas({
        name,
        tier,
        sub: locked ? 'Locked' : (dateLabel || 'Earned'),
        locked,
      })), textures);
      backTex.colorSpace = THREE.SRGBColorSpace;
      const backMat = keep(new THREE.MeshStandardMaterial({
        map: backTex, roughness: 0.38, metalness: locked ? 0.2 : 0.55,
      }), materials);
      const backGeo = keep(new THREE.CircleGeometry(0.93, 96), geometries);
      const back = new THREE.Mesh(backGeo, backMat);
      back.position.z = -(depth / 2 + bevelT + 0.012);
      back.rotation.y = Math.PI;
      group.add(back);

      // Interaction and motion.
      let rotY = 0;
      let rotX = 0;
      let vel = 0;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let raf = 0;
      let last = performance.now();
      const introStart = performance.now();
      const introFrom = -Math.PI * 2.2;
      let introDone = !intro;

      const down = e => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        vel = 0;
        canvas.setPointerCapture?.(e.pointerId);
      };
      const move = e => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        rotY += dx * 0.011;
        rotX = Math.max(-0.6, Math.min(0.6, rotX + dy * 0.007));
        vel = dx * 0.011;
      };
      const up = () => {
        dragging = false;
      };
      if (interactive) {
        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);
      }

      const frame = now => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!introDone) {
          const k = Math.min(1, (now - introStart) / 1400);
          const e = 1 - Math.pow(1 - k, 3);
          group.rotation.y = introFrom * (1 - e) + rotY * e;
          if (k >= 1) introDone = true;
        } else {
          if (!dragging) {
            if (Math.abs(vel) > 0.0004) {
              rotY += vel;
              vel *= 0.93;
            } else if (autoSpin && !reduce) {
              rotY += 0.5 * dt;
            }
          }
          group.rotation.y = rotY;
        }
        group.rotation.x = rotX;
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);

      return () => {
        cancelAnimationFrame(raf);
        if (interactive) {
          canvas.removeEventListener('pointerdown', down);
          canvas.removeEventListener('pointermove', move);
          canvas.removeEventListener('pointerup', up);
          canvas.removeEventListener('pointercancel', up);
        }
        geometries.forEach(g => g.dispose());
        materials.forEach(m => m.dispose());
        textures.forEach(t => t.dispose());
        scene.environment?.dispose?.();
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      };
    };

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!teardown) teardown = mount();
      } else if (teardown) {
        teardown();
        teardown = null;
      }
    }, { rootMargin: '120px' });
    io.observe(host);

    return () => {
      io.disconnect();
      if (teardown) teardown();
      teardown = null;
    };
  }, [tier, emblem, locked, name, dateLabel, size, interactive, autoSpin, intro]);

  return <div ref={hostRef} className="medal-host" style={{ width: '100%', maxWidth: size }} />;
}
