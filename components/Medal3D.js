'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildMedalGroup, TIER_NAME } from '../lib/medalScene';

// How far a medal may turn: about 63 degrees either side, and a small tilt.
// Front and engraved back stay in view.
const ARC_YAW = 1.1;
const ARC_PITCH = 0.35;

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

    // The scene is built only while the medal is on screen, so a long list of medals
    // never holds more WebGL contexts than iPhone Safari allows.
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

      const built = buildMedalGroup({ tier, emblem, name, dateLabel, locked });
      built.group.position.y = -0.1;
      scene.add(built.group);

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
        rotY = Math.max(-ARC_YAW, Math.min(ARC_YAW, rotY + dx * 0.011));
        rotX = Math.max(-ARC_PITCH, Math.min(ARC_PITCH, rotX + dy * 0.007));
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
          built.group.rotation.y = introFrom * (1 - e) + rotY * e;
          if (k >= 1) introDone = true;
        } else {
          if (!dragging) {
            if (Math.abs(vel) > 0.0004) {
              rotY = Math.max(-ARC_YAW, Math.min(ARC_YAW, rotY + vel));
              vel *= 0.93;
            } else if (autoSpin && !reduce) {
              rotY = ARC_YAW * 0.85 * Math.sin(now / 1800);
            }
          }
          built.group.rotation.y = rotY;
        }
        built.group.rotation.x = rotX;
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
        built.dispose();
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
