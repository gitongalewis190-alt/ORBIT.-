import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { barPathVertical, NAV } from '../lib/tabs.js';

const R = NAV.r + NAV.gap;
const dy = Math.sqrt(R * R - NAV.cy * NAV.cy);

const d = barPathVertical({ length: 800, thickness: 72, cy: 200 });
assert.ok(d.includes(`A ${R} ${R} 0 1 0 72 ${(200 + dy).toFixed(2)}`), d);
assert.ok(d.startsWith('M '), 'vertical path starts on the outline');
assert.ok(d.endsWith('Z'), 'vertical path closes');

const moved = barPathVertical({ length: 800, thickness: 72, cy: 400 });
assert.notEqual(d, moved, 'the notch follows the active tab');

const chrome = readFileSync(new URL('../app/orbit-chrome.css', import.meta.url), 'utf8');
assert.equal(chrome.includes('margin-left: 280px'), false, 'the plain desktop column is gone');
assert.equal(/@media \(min-width: 1024px\)[\s\S]*?\.obar \{ display: none/.test(chrome), false, 'a wide screen no longer removes the sculpted bar');
assert.ok(chrome.includes('.obar.is-vertical'), 'the vertical bar is the same component');
assert.ok(chrome.includes('.obar:not(.is-vertical) { display: none; }'), 'phone and laptop do not show two bars');

const gear = readFileSync(new URL('../app/styles/base.css', import.meta.url), 'utf8');
assert.ok(gear.includes('transform: none'), 'the settings control does not spin');
assert.ok(readFileSync(new URL('../app/styles/base.css', import.meta.url), 'utf8').includes('text-decoration: none'));

console.log('nav orientation ok');
