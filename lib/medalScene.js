// The medal, built once and shared by the on-screen 3D medal and the PDF pictures.
// A bevelled solid body, a raised emblem, a hanging loop, a casing on earned medals,
// and a separately engraved back that carries the name, tier and date.
import * as THREE from 'three';

export const METAL = {
  bronze: { color: 0xc07a45, roughness: 0.32, metalness: 1 },
  silver: { color: 0xdfe2e8, roughness: 0.2, metalness: 1 },
  gold: { color: 0xf3c764, roughness: 0.17, metalness: 1 },
  platinum: { color: 0xeef2f7, roughness: 0.1, metalness: 1 },
  obsidian: { color: 0x202026, roughness: 0.12, metalness: 0.85 },
};
export const LOCKED = { color: 0x73757d, roughness: 0.62, metalness: 0.35 };

export const BACK = {
  bronze: { a: '#f0c09a', b: '#8c5230', ink: '#2b1d14' },
  silver: { a: '#ffffff', b: '#8d929b', ink: '#23252b' },
  gold: { a: '#fff0b8', b: '#a67a2a', ink: '#2e2410' },
  platinum: { a: '#ffffff', b: '#7a8aa3', ink: '#1f2632' },
  obsidian: { a: '#4b4c57', b: '#0c0c10', ink: '#f2efe9' },
  locked: { a: '#b3b5bb', b: '#4f5159', ink: '#f2efe9' },
};
export const TIER_NAME = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', obsidian: 'Obsidian' };

export function emblemShape(kind) {
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

// The engraved back. Returns null where there is no canvas (for example in tests).
export function makeBackCanvas({ name, tier, sub, locked, holder = 'Lewis Gitonga' }) {
  if (typeof document === 'undefined') return null;
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

  // Holder's name, engraved along the lower rim of every medal back.
  g.font = '600 20px -apple-system, Helvetica, Arial, sans-serif';
  g.letterSpacing = '4px';
  g.fillText(String(holder || 'Lewis Gitonga').toUpperCase(), 256, 438);
  g.letterSpacing = '0px';
  return c;
}

// Builds the medal as a three.js group. The group is centred on the origin, front facing +Z.
// casing defaults to true for earned medals and false for locked ones.
export function buildMedalGroup({ tier = 'bronze', emblem = 'star', name = '', dateLabel = '', locked = false, casing, holder = 'Lewis Gitonga' } = {}) {
  const wearCasing = casing ?? !locked;
  const group = new THREE.Group();
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

  const depth = 0.14;
  const bevelT = 0.06;

  const bodyShape = new THREE.Shape();
  bodyShape.absarc(0, 0, 1, 0, Math.PI * 2, false);
  const bodyGeo = keep(new THREE.ExtrudeGeometry(bodyShape, {
    depth, bevelEnabled: true, bevelThickness: bevelT, bevelSize: 0.05, bevelSegments: 6, curveSegments: 72,
  }), geometries);
  bodyGeo.translate(0, 0, -depth / 2);
  group.add(new THREE.Mesh(bodyGeo, metal));

  // Casing: a bright tier-metal rim set around the edge of earned medals.
  if (wearCasing) {
    const casingGeo = keep(new THREE.TorusGeometry(1.03, 0.07, 22, 140), geometries);
    const casingMat = keep(new THREE.MeshStandardMaterial({
      color: style.color, roughness: Math.max(0.08, style.roughness - 0.05), metalness: 1,
    }), materials);
    group.add(new THREE.Mesh(casingGeo, casingMat));
  }

  const rimGeo = keep(new THREE.TorusGeometry(0.9, 0.028, 18, 120), geometries);
  const rimFront = new THREE.Mesh(rimGeo, metal);
  rimFront.position.z = depth / 2 + bevelT - 0.01;
  group.add(rimFront);
  const rimBack = new THREE.Mesh(rimGeo, metal);
  rimBack.position.z = -(depth / 2 + bevelT - 0.01);
  group.add(rimBack);

  const emblemGeo = keep(new THREE.ExtrudeGeometry(emblemShape(emblem), {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.014, bevelSegments: 3, curveSegments: 40,
  }), geometries);
  emblemGeo.translate(0, 0.02, depth / 2 + bevelT - 0.01);
  group.add(new THREE.Mesh(emblemGeo, emblemMat));

  const hangerGeo = keep(new THREE.TorusGeometry(0.2, 0.05, 20, 64), geometries);
  const hanger = new THREE.Mesh(hangerGeo, metal);
  hanger.position.set(0, 1.13, 0);
  group.add(hanger);

  // The back: its own engraved face. Without a canvas it falls back to a plain metal face.
  const canvas = makeBackCanvas({
    name,
    tier,
    sub: locked ? 'Locked' : (dateLabel || 'Earned'),
    locked,
    holder,
  });
  let backMat;
  if (canvas) {
    const tex = keep(new THREE.CanvasTexture(canvas), textures);
    tex.colorSpace = THREE.SRGBColorSpace;
    backMat = keep(new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.38, metalness: locked ? 0.2 : 0.55,
    }), materials);
  } else {
    backMat = keep(new THREE.MeshStandardMaterial({
      color: style.color, roughness: 0.4, metalness: 0.6,
    }), materials);
  }
  const backGeo = keep(new THREE.CircleGeometry(0.93, 96), geometries);
  const back = new THREE.Mesh(backGeo, backMat);
  back.position.z = -(depth / 2 + bevelT + 0.012);
  back.rotation.y = Math.PI;
  group.add(back);

  return {
    group,
    dispose() {
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      textures.forEach(t => t.dispose());
    },
  };
}
