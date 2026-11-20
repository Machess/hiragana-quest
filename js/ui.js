// Small DOM helpers, the Mochi mascot, trophies, celebrations.
import { settings } from './store.js';

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) e.style.setProperty(sk, sv); else e.style[sk] = sv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Pop-ups, toasts and petals live in #overlay, inside the scaled 1280x800 stage.
export const overlay = () => document.getElementById('overlay') || document.body;

// Keep the screen awake during play (Chrome on Android supports this).
let wakeLock = null;
let wantWake = false;
export async function keepAwake(on) {
  wantWake = on;
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { /* not allowed here; that's fine */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantWake) keepAwake(true);
});
export const reduced = () =>
  settings().reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tap handler that responds on pointerdown (snappier on tablets) but ignores scroll drags.
export function onTap(node, fn) {
  node.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    fn(e);
  });
  return node;
}

// ---------- Mochi, the mascot (original character: a round rice-cake bunny) ----------
export function mochiSVG(mood = 'idle') {
  const eyes = mood === 'sleepy'
    ? '<path d="M38 58 q6 5 12 0 M70 58 q6 5 12 0" stroke="#3b3355" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
    : mood === 'happy'
      ? '<path d="M38 60 q6 -8 12 0 M70 60 q6 -8 12 0" stroke="#3b3355" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
      : '<ellipse cx="44" cy="58" rx="4.6" ry="6" fill="#3b3355"/><ellipse cx="76" cy="58" rx="4.6" ry="6" fill="#3b3355"/>' +
        '<circle cx="45.6" cy="55.6" r="1.6" fill="#fff"/><circle cx="77.6" cy="55.6" r="1.6" fill="#fff"/>';
  const mouth = mood === 'happy'
    ? '<path d="M53 70 q7 9 14 0 z" fill="#c8506a"/>'
    : '<path d="M54 70 q6 5 12 0" stroke="#3b3355" stroke-width="3" fill="none" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 120 120" class="mochi-svg" aria-hidden="true">
    <ellipse cx="60" cy="112" rx="34" ry="5" fill="#000" opacity=".08"/>
    <g class="mochi-ears">
      <path d="M36 44 C26 10 34 2 42 6 C50 10 52 30 50 44 Z" fill="#fffdf8" stroke="#e8dccb" stroke-width="2"/>
      <path d="M40 38 C34 18 38 12 42 13 C46 15 47 28 46 38 Z" fill="#f6c4cf"/>
      <path d="M84 44 C94 10 86 2 78 6 C70 10 68 30 70 44 Z" fill="#fffdf8" stroke="#e8dccb" stroke-width="2"/>
      <path d="M80 38 C86 18 82 12 78 13 C74 15 73 28 74 38 Z" fill="#f6c4cf"/>
    </g>
    <path d="M14 82 C14 50 34 36 60 36 C86 36 106 50 106 82 C106 104 86 110 60 110 C34 110 14 104 14 82 Z" fill="#fffdf8" stroke="#e8dccb" stroke-width="2.5"/>
    <ellipse cx="32" cy="72" rx="8" ry="5" fill="#f6b7c4" opacity=".75"/>
    <ellipse cx="88" cy="72" rx="8" ry="5" fill="#f6b7c4" opacity=".75"/>
    ${eyes}${mouth}
    <path d="M52 40 q8 -8 16 0" stroke="#7fb069" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="34" r="4.5" fill="#7fb069"/>
    ${mood === 'sleepy' ? '<text x="92" y="30" font-size="16" fill="#8a8fb3" font-family="sans-serif">z</text><text x="102" y="18" font-size="12" fill="#8a8fb3" font-family="sans-serif">z</text>' : ''}
  </svg>`;
}

export function mochi(mood = 'idle', size = 'md') {
  const m = el('div', { class: `mochi mochi-${size} mood-${mood}`, html: mochiSVG(mood) });
  m.setMood = (md) => { m.className = `mochi mochi-${size} mood-${md}`; m.innerHTML = mochiSVG(md); };
  m.hop = () => {
    if (reduced()) return;
    m.classList.remove('hop'); void m.offsetWidth; m.classList.add('hop');
  };
  return m;
}

// ---------- Trophies ----------
const METALS = {
  0: { a: '#d9d4c7', b: '#c4bfb2', name: 'locked' },
  1: { a: '#e3a46b', b: '#a8642f', name: 'bronze' },
  2: { a: '#eef1f6', b: '#9aa3b2', name: 'silver' },
  3: { a: '#ffe08a', b: '#d39b14', name: 'gold' },
};
export function trophySVG(h, level, id = Math.random().toString(36).slice(2, 7), met = false) {
  const m = METALS[level];
  const g = `tg${id}`;
  const locked = level === 0;
  return `<svg viewBox="0 0 100 120" class="trophy-svg lvl-${level}" role="img" aria-label="${m.name} trophy ${locked ? '' : h}">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.a}"/><stop offset="1" stop-color="${m.b}"/></linearGradient></defs>
    <path d="M22 18 C6 18 6 46 28 50" fill="none" stroke="url(#${g})" stroke-width="6"/>
    <path d="M78 18 C94 18 94 46 72 50" fill="none" stroke="url(#${g})" stroke-width="6"/>
    <path d="M20 10 H80 V30 C80 56 66 68 50 68 C34 68 20 56 20 30 Z" fill="url(#${g})"/>
    <rect x="44" y="66" width="12" height="16" fill="url(#${g})"/>
    <rect x="28" y="82" width="44" height="10" rx="3" fill="url(#${g})"/>
    <rect x="22" y="92" width="56" height="16" rx="4" fill="${locked ? '#cfc9bb' : '#5b4a3a'}"/>
    ${locked && met
      ? `<text x="50" y="49" text-anchor="middle" font-size="32" fill="#fffaf0" opacity=".9" font-family="Klee One, serif" font-weight="600">${h}</text>`
      : locked
      ? '<text x="50" y="47" text-anchor="middle" font-size="26" fill="#f5f1e8" font-family="M PLUS Rounded 1c, sans-serif">?</text>'
      : `<text x="50" y="49" text-anchor="middle" font-size="32" fill="${level === 2 ? '#4a5266' : '#fffaf0'}" font-family="Klee One, serif" font-weight="600">${h}</text>`}
  </svg>`;
}
// Big lantern trophy for a whole completed row.
export function lanternSVG(label, lit) {
  return `<svg viewBox="0 0 100 130" class="lantern-svg ${lit ? 'lit' : ''}" role="img" aria-label="row trophy ${label}">
    <rect x="34" y="4" width="32" height="10" rx="3" fill="${lit ? '#3b3355' : '#bdb6a6'}"/>
    <ellipse cx="50" cy="66" rx="40" ry="50" fill="${lit ? '#e4572e' : '#ddd6c6'}"/>
    ${[30, 46, 62, 78, 94].map((y) => `<path d="M12 ${y} Q50 ${y + 6} 88 ${y}" stroke="${lit ? '#b8401f' : '#cbc3b1'}" stroke-width="2" fill="none"/>`).join('')}
    <rect x="34" y="114" width="32" height="10" rx="3" fill="${lit ? '#3b3355' : '#bdb6a6'}"/>
    <text x="50" y="80" text-anchor="middle" font-size="40" fill="${lit ? '#fff8e8' : '#f3eee3'}" font-family="Klee One, serif" font-weight="600">${label}</text>
  </svg>`;
}

// ---------- Celebrations (short, soft, no flashing) ----------
export function petals(count = 14) {
  if (reduced()) count = Math.min(count, 4);
  const layer = el('div', { class: 'petal-layer' });
  for (let i = 0; i < count; i++) {
    const p = el('div', { class: 'petal' });
    p.style.left = Math.random() * 1280 + 'px';
    p.style.animationDelay = Math.random() * 0.6 + 's';
    p.style.animationDuration = 2 + Math.random() * 1.2 + 's';
    p.style.setProperty('--drift', (Math.random() * 120 - 60) + 'px');
    p.style.setProperty('--spin', (Math.random() * 360 + 180) + 'deg');
    layer.append(p);
  }
  overlay().append(layer);
  setTimeout(() => layer.remove(), 4000);
}

export function toast(content, ms = 1800) {
  const t = el('div', { class: 'toast' }, content);
  overlay().append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
}

// Parent gate: the button must be held for `ms` milliseconds.
export function holdButton(label, ms, onDone, cls = '') {
  const b = el('button', { class: `hold-btn ${cls}`, type: 'button' },
    el('span', { class: 'hold-fill' }), el('span', { class: 'hold-label' }, label));
  let timer = null;
  const fill = b.querySelector('.hold-fill');
  const start = (e) => {
    e.preventDefault();
    fill.style.transition = `transform ${ms}ms linear`;
    fill.style.transform = 'scaleX(1)';
    timer = setTimeout(() => { cancel(); onDone(); }, ms);
  };
  const cancel = () => {
    clearTimeout(timer);
    fill.style.transition = 'transform .2s';
    fill.style.transform = 'scaleX(0)';
  };
  b.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, cancel));
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return b;
}

export function speakerIcon() {
  return '<svg viewBox="0 0 24 24" class="ico"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
}
export function icon(name) {
  const I = {
    back: '<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="currentColor"/>',
    bulb: '<path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM9.5 19h5v2h-5z" fill="currentColor"/>',
    undo: '<path d="M9 7H4V2M4.5 7A8.5 8.5 0 1 1 6 17" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    gear: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.4 5l-1.9-.3a6.9 6.9 0 0 1-.8 1.9l1.1 1.6-1.6 1.6-1.6-1.1a6.9 6.9 0 0 1-1.9.8l-.3 1.9h-2.3l-.3-1.9a6.9 6.9 0 0 1-1.9-.8l-1.6 1.1-1.6-1.6 1.1-1.6a6.9 6.9 0 0 1-.8-1.9L3.6 13.5v-2.3l1.9-.3c.2-.7.4-1.3.8-1.9L5.2 7.4 6.8 5.8l1.6 1.1c.6-.4 1.2-.6 1.9-.8l.3-1.9h2.3l.3 1.9c.7.2 1.3.4 1.9.8l1.6-1.1 1.6 1.6-1.1 1.6c.4.6.6 1.2.8 1.9l1.9.3z" fill="currentColor"/>',
    play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  };
  return `<svg viewBox="0 0 24 24" class="ico">${I[name] || ''}</svg>`;
}
