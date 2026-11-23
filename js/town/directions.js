// The streets (みち): directions. Words first (みぎ, ひだり, まっすぐ, とまって, places), then
// sentences (ふたつめの かどを みぎに まがって, はしを わたって …), ending with the challenge:
// hear a whole route once and find where it ends on the map.
// Turning is relative to the way Mochi faces, as in real life; early lessons show little
// ひだり / みぎ signs beside Mochi to help.
import { el, wait, said, petals, mochiSVG } from '../ui.js';
import * as A from '../audio.js';
import { record, shuffle } from '../learn.js';
import { BASIC, quiet, topic, bubbleLine, replayBtn, shake, lessonList, readableText } from './common.js';

// ---------------- The town grid ----------------
const COLS = 5, ROWS = 4;
const NX = (i) => 100 + i * 200;
const NY = (j) => 55 + j * 130;
const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];             // facing: 0 up, 1 right, 2 down, 3 left
const BRIDGE_COLS = [1, 3];                                // the river lies between rows 1 and 2
const inside = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
// The street between two neighbouring corners: null (none), 'road' or 'bridge'.
function edge(x, y, f) {
  const [dx, dy] = DIR[f];
  const nx = x + dx, ny = y + dy;
  if (!inside(nx, ny)) return null;
  if (dy !== 0 && Math.min(y, ny) === 1) return BRIDGE_COLS.includes(x) ? 'bridge' : null;
  return 'road';
}
// Each place stands at one corner (node); its building sits in the block beside it (at).
const PLACES = {
  eki: { node: [1, 0], at: [-1, 1] },
  honya: { node: [2, 1], at: [-1, -1] },
  gakkou: { node: [2, 0], at: [1, 1] },
  toshokan: { node: [4, 0], at: [-1, 1] },
  mise: { node: [0, 3], at: [1, -1] },
  otera: { node: [1, 2], at: [1, 1] },
  ie: { node: [2, 3], at: [1, -1] },
  kouen: { node: [4, 2], at: [-1, 1] },
};
const placeAt = (x, y) => Object.keys(PLACES).find((k) => PLACES[k].node[0] === x && PLACES[k].node[1] === y);
const word = (k) => A.line(`d_${k}`);

// ---------------- Sentences (phrases) and routes ----------------
// A phrase is one spoken instruction and the button presses it means:
// F = まっすぐ (to the next corner), R / L = turn みぎ / ひだり there, S = とまって.
function phrasesFrom(x, y, f) {
  const out = [];
  let cx = x, cy = y;
  for (let n = 1; n <= 3; n++) {
    if (edge(cx, cy, f) !== 'road') break;
    cx += DIR[f][0]; cy += DIR[f][1];
    const fw = Array(n).fill('F');
    out.push({ id: `ds_${n}stop`, moves: [...fw, 'S'], x: cx, y: cy, f, stop: true });
    for (const [t, nf, name] of [['R', (f + 1) % 4, 'migi'], ['L', (f + 3) % 4, 'hidari']]) {
      if (edge(cx, cy, nf)) out.push({ id: `ds_${n}${name}`, moves: [...fw, t], x: cx, y: cy, f: nf });
    }
  }
  if (edge(x, y, f) === 'bridge') out.push({ id: 'ds_hashi', moves: ['F'], x: x + DIR[f][0], y: y + DIR[f][1], f, bridge: true });
  return out;
}
// Every route that starts at a place (Mochi facing along a street) and ends with "stop" at a
// different place, without going in circles.
const HOME = { x: 2, y: 3, f: 0 };
function allRoutes(maxPhrases = 4) {
  const routes = [];
  for (const [from, pl] of Object.entries(PLACES)) {
    for (let f = 0; f < 4; f++) {
      const [x, y] = pl.node;
      if (!edge(x, y, f)) continue;
      const walk = (st, path, seen) => {
        for (const ph of phrasesFrom(st.x, st.y, st.f)) {
          const key = `${ph.x},${ph.y}`;
          if (seen.has(key)) continue;
          const next = [...path, ph];
          if (ph.stop) {
            const to = placeAt(ph.x, ph.y);
            if (to && to !== from) routes.push({ start: { x, y, f }, from, phrases: next, place: to });
          } else if (next.length < maxPhrases) walk(ph, next, new Set([...seen, key]));
        }
      };
      walk({ x, y, f }, [], new Set([`${x},${y}`]));
    }
  }
  return routes;
}
// n routes with the given lengths, all ending at different places.
function pickRoutes(lengths) {
  const all = allRoutes(4);
  const used = new Set();
  return lengths.map((n) => {
    const pool = all.filter((r) => r.phrases.length === n && !used.has(r.place));
    const r = shuffle(pool.length ? pool : all.filter((x) => !used.has(x.place)))[0] || shuffle(all)[0];
    used.add(r.place);
    return r;
  });
}

// ---------------- Map drawing ----------------
function mapSVG() {
  const roads = [], bridges = [];
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) for (const f of [1, 2]) {
    const e = edge(x, y, f);
    if (!e) continue;
    const seg = [NX(x), NY(y), NX(x + DIR[f][0]), NY(y + DIR[f][1])];
    (e === 'bridge' ? bridges : roads).push(seg);
  }
  const line = ([a, b, c, d], w, col) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const tree = (x, y) => `<g transform="translate(${x} ${y})"><rect x="-3" y="4" width="6" height="14" fill="#a8774a"/><circle r="15" fill="#8cc084"/><circle cx="-8" cy="4" r="10" fill="#7fb069"/></g>`;
  const b = {
    ie: '<path d="M-40 0 L0 -32 L40 0 Z" fill="#e05a6d"/><rect x="-32" y="0" width="64" height="40" fill="#fff6e6" stroke="#e2d7c1" stroke-width="2"/><rect x="-8" y="14" width="16" height="26" rx="3" fill="#a8774a"/>',
    mise: '<rect x="-40" y="-26" width="80" height="58" fill="#fff6e6" stroke="#e2d7c1" stroke-width="2"/><path d="M-44 -26 h88 l-6 -14 h-76 z" fill="#2b3a67"/>' + [0, 1, 2, 3].map((i) => `<rect x="${-40 + i * 20}" y="-26" width="10" height="12" fill="#e05a6d"/>`).join('') + '<rect x="-28" y="-6" width="56" height="26" rx="4" fill="#bfe3f2"/>',
    kouen: '<rect x="-46" y="-30" width="92" height="62" rx="16" fill="#b9dca4"/><circle cx="-20" cy="-6" r="13" fill="#7fb069"/><circle cx="18" cy="-10" r="11" fill="#8cc084"/><rect x="-6" y="14" width="30" height="6" rx="2" fill="#a8774a"/><circle cx="-28" cy="18" r="5" fill="#f28fb0"/>',
    eki: '<rect x="-44" y="-22" width="88" height="54" fill="#eaf1fb" stroke="#9fb3d1" stroke-width="2"/><path d="M-50 -22 h100 l-10 -16 h-80 z" fill="#4a7bd0"/><circle cx="0" cy="-2" r="11" fill="#fff" stroke="#3b3355" stroke-width="2"/><path d="M0 -2 v-7 M0 -2 h5" stroke="#3b3355" stroke-width="2"/><rect x="-30" y="14" width="60" height="10" rx="3" fill="#bfe3f2"/>',
    toshokan: '<rect x="-44" y="-20" width="88" height="52" fill="#f1ecf8" stroke="#bfb0dc" stroke-width="2"/><path d="M-50 -20 L0 -40 L50 -20 Z" fill="#8a6fa8"/><path d="M-20 2 q10 -8 20 0 q10 -8 20 0 v18 q-10 -6 -20 0 q-10 -6 -20 0 z" fill="#fff" stroke="#3b3355" stroke-width="1.5"/><path d="M0 2 v18" stroke="#3b3355" stroke-width="1.5"/>',
    otera: '<rect x="-30" y="-4" width="60" height="36" fill="#f6e3c8" stroke="#c9a57a" stroke-width="2"/><path d="M-48 -4 q48 -10 96 0 l-10 -12 h-76 z" fill="#4a3b5c"/><path d="M-30 -18 q30 -8 60 0 l-8 -10 h-44 z" fill="#4a3b5c"/><rect x="-8" y="10" width="16" height="22" fill="#c94458"/><path d="M-36 32 h72" stroke="#c9a57a" stroke-width="4"/>',
    honya: '<rect x="-40" y="-24" width="80" height="56" fill="#fff6e6" stroke="#e2d7c1" stroke-width="2"/><path d="M-44 -24 h88 l-6 -12 h-76 z" fill="#4f9d69"/><rect x="-30" y="-6" width="60" height="28" rx="3" fill="#bfe3f2"/>' + ['#e05a6d', '#ffd166', '#4a7bd0', '#7fb069', '#f2a541'].map((c, i) => `<rect x="${-26 + i * 11}" y="${2 - (i % 2) * 3}" width="8" height="${16 + (i % 2) * 3}" fill="${c}"/>`).join(''),
    gakkou: '<rect x="-42" y="-18" width="84" height="50" fill="#fff1d6" stroke="#e3cf8e" stroke-width="2"/><rect x="-14" y="-38" width="28" height="22" fill="#fff1d6" stroke="#e3cf8e" stroke-width="2"/><circle cx="0" cy="-27" r="7" fill="#fff" stroke="#3b3355" stroke-width="1.5"/><path d="M30 -18 v-26" stroke="#8c7756" stroke-width="2"/><path d="M30 -44 h14 l-4 5 l4 5 h-14" fill="#e05a6d"/>' + [-28, -8, 12].map((x) => `<rect x="${x}" y="-6" width="14" height="12" fill="#bfe3f2"/>`).join(''),
  };
  const bld = Object.entries(PLACES).map(([k, pl]) => {
    const [x, y] = pl.node;
    return `<g transform="translate(${NX(x) + pl.at[0] * 92} ${NY(y) + pl.at[1] * 64})">${b[k]}</g>`;
  }).join('');
  return `<svg viewBox="0 0 1000 500" class="street-svg" aria-hidden="true">
    <rect width="1000" height="500" rx="26" fill="#d9ecc9"/>
    <rect x="0" y="216" width="1000" height="68" fill="#a8d4ee"/>
    <path d="M30 240 q20 -8 40 0 t40 0 M300 262 q20 -8 40 0 t40 0 M620 238 q20 -8 40 0 t40 0 M840 264 q20 -8 40 0 t40 0" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>
    ${roads.map((s) => line(s, 40, '#dccfb4')).join('')}${roads.map((s) => line(s, 32, '#f6eedd')).join('')}
    ${bridges.map(([a, bb, c, d]) => `<rect x="${a - 24}" y="${bb + 14}" width="48" height="${d - bb - 28}" rx="6" fill="#c9a57a"/><path d="M${a - 22} ${bb + 20} V${d - 20} M${a + 22} ${bb + 20} V${d - 20}" stroke="#8c6a44" stroke-width="5"/>`).join('')}
    ${[[40, 120], [960, 130], [40, 382], [960, 380]].filter(([x, y]) => !Object.values(PLACES).some((pl) => Math.abs(NX(pl.node[0]) + pl.at[0] * 92 - x) < 70 && Math.abs(NY(pl.node[1]) + pl.at[1] * 64 - y) < 60)).map(([x, y]) => tree(x, y)).join('')}
    ${bld}
  </svg>`;
}

// The street map with Mochi on it. Returns controls for moving Mochi and choosing places.
function streetMap({ hints = false, labels = true } = {}) {
  const st = { ...HOME };
  const sprite = el('div', { class: 'walker' });
  const body = el('div', { class: 'walker-body', html: mochiSVG('idle') });
  const arrow = el('div', { class: 'walker-arrow' }, '▲');
  const ring = el('div', { class: 'walker-hints' }, el('span', { class: 'hint-l kana' }, 'ひだり'), el('span', { class: 'hint-r kana' }, 'みぎ'));
  sprite.append(ring, arrow, body);
  const spots = {};
  const labelEls = {};
  const placeBtns = Object.entries(PLACES).map(([k, pl]) => {
    const [x, y] = pl.node;
    const cx = NX(x) + pl.at[0] * 92, cy = NY(y) + pl.at[1] * 64;
    const lab = el('span', { class: 'place-label kana' }, word(k).ja);
    labelEls[k] = lab;
    const b = el('button', { class: 'place-btn', 'data-place': k, style: { left: `${cx - 55}px`, top: `${cy - 45}px` } }, lab);
    spots[k] = [b];
    return b;
  });
  const bridgeBtns = BRIDGE_COLS.map((x) => {
    const b = el('button', { class: 'place-btn bridge', 'data-place': 'hashi', style: { left: `${NX(x) - 40}px`, top: `${210}px` } }, el('span', { class: 'place-label kana' }, word('hashi').ja));
    return b;
  });
  spots.hashi = bridgeBtns;
  labelEls.hashi = bridgeBtns.map((b) => b.firstChild);
  const root = el('div', { class: 'street-map' + (labels ? '' : ' no-labels') }, el('div', { class: 'street-art', html: mapSVG() }), ...placeBtns, ...bridgeBtns, sprite);
  const draw = () => {
    sprite.style.transform = `translate(${NX(st.x) - 40}px, ${NY(st.y) - 52}px)`;
    arrow.style.transform = `rotate(${st.f * 90}deg)`;
    ring.style.transform = `rotate(${st.f * 90}deg)`;
    ring.querySelectorAll('span').forEach((s) => { s.style.transform = `rotate(${-st.f * 90}deg)`; });
  };
  const turnDeg = { cur: 0 };
  const api = {
    root, st, spots,
    setHints(on) { ring.classList.toggle('on', on); },
    setLabels(on) { root.classList.toggle('no-labels', !on); },
    place(x, y, f) { Object.assign(st, { x, y, f }); turnDeg.cur = f * 90; sprite.classList.add('jump-to'); draw(); requestAnimationFrame(() => sprite.classList.remove('jump-to')); },
    canMove() { return !!edge(st.x, st.y, st.f); },
    async move() {
      if (!edge(st.x, st.y, st.f)) return false;
      st.x += DIR[st.f][0]; st.y += DIR[st.f][1];
      draw(); await wait(650);
      return true;
    },
    async turn(t) {
      st.f = (st.f + (t === 'R' ? 1 : 3)) % 4;
      draw(); body.classList.remove('hop'); void body.offsetWidth; body.classList.add('hop');
      await wait(450);
    },
    async stop() { body.classList.remove('hop'); void body.offsetWidth; body.classList.add('hop'); await wait(450); },
    async perform(m) { if (m === 'F') return api.move(); if (m === 'S') return api.stop(); return api.turn(m); },
    shake() { shake(body); },
    happy() { body.innerHTML = mochiSVG('happy'); setTimeout(() => { body.innerHTML = mochiSVG('idle'); }, 1200); },
  };
  api.setHints(hints);
  draw();
  return api;
}

// The four direction buttons (arrows only: the words are what the child listens for).
function controls() {
  let handler = null;
  const mk = (m, sym, label) => {
    const b = el('button', { class: `dir-btn d-${m}`, 'aria-label': label, 'data-move': m }, sym);
    b.onclick = () => handler && handler(m, b);
    return b;
  };
  const root = el('div', { class: 'dir-pad' }, mk('L', '↰', 'left'), mk('F', '↑', 'straight on'), mk('R', '↱', 'right'), mk('S', '✋', 'stop'));
  return { root, next: () => new Promise((res) => { handler = (m, b) => { handler = null; res([m, b]); }; }) };
}

// The child presses the buttons for one phrase. Wrong presses don't move Mochi.
async function doPhrase(s, map, pad, ph, replay) {
  let first = true;
  for (const want of ph.moves) {
    for (;;) {
      const [m, b] = await pad.next();
      if (m === want) { await map.perform(m); break; }
      if (first) s.miss(null);
      first = false;
      A.tok(); shake(b); map.shake();
      await wait(700);
      replay();
    }
  }
  if (first) s.correct(null); else A.chime(0);
  return first;
}

// ---------------- The crossroads (lessons 1 and 2) ----------------
function crossroads() {
  const body = el('div', { class: 'walker-body', html: mochiSVG('idle') });
  const mover = el('div', { class: 'cross-mochi' }, el('div', { class: 'walker-arrow' }, '▲'), body);
  const root = el('div', { class: 'crossroads' },
    el('div', { class: 'cross-art', html: '<svg viewBox="0 0 520 360"><rect width="520" height="360" rx="24" fill="#d9ecc9"/><rect x="220" y="0" width="80" height="360" fill="#f6eedd" stroke="#dccfb4" stroke-width="4"/><rect x="0" y="140" width="520" height="80" fill="#f6eedd" stroke="#dccfb4" stroke-width="4"/><rect x="222" y="142" width="76" height="76" fill="#f6eedd"/><circle cx="80" cy="60" r="26" fill="#8cc084"/><circle cx="440" cy="300" r="26" fill="#8cc084"/><circle cx="450" cy="60" r="20" fill="#7fb069"/></svg>' }),
    mover);
  const go = (tf, ms = 700) => { mover.style.transform = tf; return wait(ms); };
  const act = async (w) => {
    if (w === 'massugu') { await go('translate(0, -110px)'); await go('translate(0, 0)', 600); }
    if (w === 'migi') { mover.querySelector('.walker-arrow').style.transform = 'rotate(90deg)'; await go('translate(130px, 0)'); await go('translate(0, 0)', 600); }
    if (w === 'hidari') { mover.querySelector('.walker-arrow').style.transform = 'rotate(-90deg)'; await go('translate(-130px, 0)'); await go('translate(0, 0)', 600); }
    if (w === 'tomatte') { body.classList.remove('hop'); void body.offsetWidth; body.classList.add('hop'); await wait(700); }
    mover.querySelector('.walker-arrow').style.transform = 'rotate(0deg)';
  };
  return { root, act };
}
const MOVE_WORD = { L: 'hidari', F: 'massugu', R: 'migi', S: 'tomatte' };

// ---------------- Lessons ----------------
// 1 · Which way? Tap each word card: hear it and watch Mochi do it.
async function lessonWords(s) {
  const c = crossroads();
  const bub = bubbleLine('di_michi');
  const cards = el('div', { class: 'word-tray' });
  s.view('town-lesson', bub, c.root, cards);
  A.say('di_michi', { lead: 400 });
  const left = new Set(['hidari', 'massugu', 'migi', 'tomatte']);
  const icon = { hidari: '↰', massugu: '↑', migi: '↱', tomatte: '✋' };
  await new Promise((done) => {
    cards.replaceChildren(...['hidari', 'massugu', 'migi', 'tomatte'].map((w) => {
      const b = el('button', { class: 'word-card kana dir-word', 'data-w': w }, el('span', { class: 'dw-icon' }, icon[w]), word(w).ja);
      let busy = false;
      b.onclick = async () => {
        if (busy) return;
        busy = true;
        bub.replaceChildren(...said(`d_${w}`));
        A.say(`d_${w}`, { interrupt: true });
        await c.act(w);
        await A.idle();
        b.classList.add('right');
        left.delete(w);
        s.practise();
        busy = false;
        if (!left.size) done();
      };
      return b;
    }));
  });
}

// 2 · Do it! Mochi says a direction word; tap the arrow that means it.
async function lessonDoIt(s) {
  const c = crossroads();
  const pad = controls();
  const bub = bubbleLine('di_yatte');
  let target = null;
  const v = s.view('town-lesson', el('div', { class: 'town-top' }, bub, replayBtn(() => target && quiet(`d_${target}`))), el('div', { class: 'street-row' }, c.root, pad.root));
  A.say('di_yatte', { lead: 400 });
  const rounds = shuffle(['hidari', 'massugu', 'migi', 'tomatte', 'hidari', 'migi', 'massugu', 'tomatte']);
  for (const [i, w] of rounds.entries()) {
    await s.calm(700);
    target = w;
    v.dataset.target = `${w}#${i}`;
    bub.replaceChildren(...said('di_yatte'));
    quiet(`d_${w}`);
    let first = true;
    for (;;) {
      const [m, b] = await pad.next();
      if (MOVE_WORD[m] === w) {
        if (first) s.correct(null); else A.chime(0);
        bub.replaceChildren(...said(`d_${w}`));
        A.say(`d_${w}`);
        await c.act(w);
        break;
      }
      if (first) s.miss(null);
      first = false;
      A.tok(); shake(b);
      await wait(600);
      quiet(`d_${w}`);
    }
  }
}

// 3 · Places in town: meet them, find them by sound, then find them by reading.
async function lessonPlaces(s) {
  const map = streetMap({ labels: true });
  map.root.querySelector('.walker').style.display = 'none';
  const bub = bubbleLine('di_michi');
  let target = null;
  const v = s.view('town-lesson', el('div', { class: 'town-top' }, bub, replayBtn(() => target && quiet(`dw_${target}`))), map.root);
  const order = ['ie', 'mise', 'eki', 'hashi', 'gakkou', 'kouen', 'toshokan', 'otera', 'honya'];
  const tapPlace = (keys) => new Promise((res) => {
    const all = [];
    keys.forEach((k) => map.spots[k].forEach((b) => { const h = () => { all.forEach(([bb, hh]) => bb.removeEventListener('click', hh)); res([k, b]); }; all.push([b, h]); b.addEventListener('click', h); }));
  });
  // a) meet
  for (const k of order) {
    await s.calm(500);
    map.spots[k].forEach((b) => b.classList.add('glow'));
    await tapPlace([k]);
    map.spots[k].forEach((b) => b.classList.remove('glow'));
    bub.replaceChildren(...said(`d_${k}`));
    A.say(`d_${k}`, { interrupt: true });
    s.practise();
  }
  // b) where is …? (by sound; labels hidden)
  map.setLabels(false);
  for (const [i, k] of shuffle([...order]).slice(0, 6).entries()) {
    await s.calm(700);
    target = k; v.dataset.target = `${k}#b${i}`;
    bub.replaceChildren(...said('di_kiite'));
    quiet(`dw_${k}`);
    let first = true;
    for (;;) {
      const [got, b] = await tapPlace(order);
      if (got === k) {
        if (first) s.correct(null); else A.chime(0);
        b.classList.add('glow'); bub.replaceChildren(...said(`d_${k}`)); A.say(`d_${k}`);
        await A.idle(); b.classList.remove('glow');
        break;
      }
      if (first) s.miss(null);
      first = false;
      shake(b); await quiet(`d_${got}`); await wait(400); quiet(`dw_${k}`);
    }
  }
  // c) read it: the name is written, find the place
  target = null;
  for (const [i, k] of shuffle(order.filter((k) => readableText(word(k).ja))).slice(0, 5).entries()) {
    await s.calm(700);
    v.dataset.target = `${k}#c${i}`;
    bub.replaceChildren(el('span', { class: 'said-ja kana read-big' }, word(k).ja), el('span', { class: 'said-en' }, 'Read it, then tap the place'));
    let first = true;
    for (;;) {
      const [got, b] = await tapPlace(order);
      if (got === k) {
        if (first) { s.correct(null); [...word(k).ja].forEach((h) => BASIC.has(h) && record(s.p, h, 'use', true, 0.05)); } else A.chime(0);
        b.classList.add('glow'); bub.replaceChildren(...said(`d_${k}`)); A.say(`d_${k}`);
        await A.idle(); b.classList.remove('glow');
        break;
      }
      if (first) s.miss(null);
      first = false;
      shake(b); quiet(`d_${got}`);
    }
  }
  map.setLabels(true);
}

// 4 · Corners and bridges: one sentence at a time, from different spots in town.
async function lessonCorners(s) {
  const map = streetMap({ hints: true });
  const pad = controls();
  let replay = null;
  const bub = bubbleLine('di_kiite');
  const v = s.view('town-lesson', el('div', { class: 'town-top' }, bub, replayBtn(() => replay && replay())), el('div', { class: 'street-row' }, map.root, pad.root));
  A.say('di_kiite', { lead: 400 });
  // A mix: corners 1–3, left and right, stopping, and the bridges.
  const starts = [];
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) for (let f = 0; f < 4; f++) phrasesFrom(x, y, f).forEach((ph) => starts.push({ x, y, f, ph }));
  const pick = (test) => shuffle(starts.filter((t) => test(t.ph)))[0];
  const tasks = shuffle([pick((p) => p.id === 'ds_1migi'), pick((p) => p.id === 'ds_1hidari'), pick((p) => p.id === 'ds_hashi'),
    pick((p) => /ds_2(migi|hidari)/.test(p.id)), pick((p) => /ds_[12]stop/.test(p.id)), pick((p) => /ds_3|ds_2stop/.test(p.id))].filter(Boolean));
  for (const [i, t] of tasks.entries()) {
    await s.calm(800);
    map.place(t.x, t.y, t.f);
    await wait(400);
    v.dataset.target = `${t.ph.moves.join('')}#${i}`;
    bub.replaceChildren(...said('di_kiite'));
    replay = () => quiet(t.ph.id);
    replay();
    await doPhrase(s, map, pad, t.ph, replay);
    bub.replaceChildren(...said(t.ph.id));
    A.say(t.ph.id);
    map.happy();
  }
}

// 5 · Follow the way: a whole route from home, one sentence at a time.
async function lessonFollow(s) {
  const map = streetMap({ hints: true });
  const pad = controls();
  let replay = null;
  const bub = bubbleLine('di_tsuite');
  const v = s.view('town-lesson', el('div', { class: 'town-top' }, bub, replayBtn(() => replay && replay())), el('div', { class: 'street-row' }, map.root, pad.root));
  A.say('di_tsuite', { lead: 400 });
  const chosen = pickRoutes([2, 3, 3]);
  for (const [ri, r] of chosen.entries()) {
    await s.calm(800);
    map.place(r.start.x, r.start.y, r.start.f);
    for (const [pi, ph] of r.phrases.entries()) {
      await s.calm(500);
      v.dataset.target = `${ph.moves.join('')}#${ri}.${pi}`;
      bub.replaceChildren(...said('di_kiite'));
      replay = () => quiet(ph.id);
      replay();
      await doPhrase(s, map, pad, ph, replay);
      bub.replaceChildren(...said(ph.id));
      A.say(ph.id);
    }
    await s.calm(400);
    map.spots[r.place].forEach((b) => b.classList.add('glow'));
    bub.replaceChildren(...said(`da_${r.place}`));
    A.say(`da_${r.place}`);
    map.happy(); petals(10);
    await A.idle(); await wait(500);
    map.spots[r.place].forEach((b) => b.classList.remove('glow'));
  }
}

// 6 · Where will we end up? Hear the whole route once (replay allowed), tap where it ends.
// Then Mochi walks it to show the way.
async function lessonChallenge(s) {
  const map = streetMap({ hints: false });
  let replay = null;
  const bub = bubbleLine('di_doko');
  const v = s.view('town-lesson', el('div', { class: 'town-top' }, bub, replayBtn(() => replay && replay())), map.root);
  A.say('di_doko', { lead: 400 });
  const rounds = pickRoutes([2, 2, 3, 4]);
  const tapPlace = () => new Promise((res) => {
    const all = [];
    Object.keys(PLACES).forEach((k) => map.spots[k].forEach((b) => { const h = () => { all.forEach(([bb, hh]) => bb.removeEventListener('click', hh)); res([k, b]); }; all.push([b, h]); b.addEventListener('click', h); }));
  });
  for (const [ri, r] of rounds.entries()) {
    await s.calm(900);
    map.place(r.start.x, r.start.y, r.start.f);
    v.dataset.target = `${r.place}#${ri}`;
    bub.replaceChildren(...said('di_doko'));
    // The whole route as one unit, with a calm pause between the sentences.
    replay = () => A.play(`audio/voice/${r.phrases[0].id}.mp3`, { interrupt: true, urls: r.phrases.map((ph) => `audio/voice/${ph.id}.mp3`), between: 1000 });
    replay();
    await A.idle();
    map.root.classList.add('ask');            // now the places can be tapped
    const [got, b] = await tapPlace();
    map.root.classList.remove('ask');
    const right = got === r.place;
    if (right) s.correct(null); else { s.miss(null); shake(b); }
    // Mochi walks the route, sentence by sentence.
    await wait(400);
    bub.replaceChildren(...said('di_mite'));
    A.say('di_mite');
    await A.idle();
    for (const ph of r.phrases) {
      bub.replaceChildren(...said(ph.id));
      quiet(ph.id, { interrupt: false });
      for (const m of ph.moves) await map.perform(m);
      await A.idle(); await wait(300);
    }
    map.spots[r.place].forEach((x) => x.classList.add('glow'));
    bub.replaceChildren(...said(`da_${r.place}`));
    A.say(`da_${r.place}`);
    if (right) { map.happy(); petals(12); }
    await A.idle(); await wait(600);
    map.spots[r.place].forEach((x) => x.classList.remove('glow'));
  }
}

const LESSONS = [
  { id: 'words', name: 'Which way?', icon: '🧭', what: 'みぎ, ひだり, まっすぐ, とまって', fn: lessonWords },
  { id: 'doit', name: 'Do it!', icon: '👂', what: 'Hear a word, tap the arrow', fn: lessonDoIt },
  { id: 'places', name: 'Places in town', icon: '🏫', what: 'Station, park, shop … by sound and by reading', fn: lessonPlaces },
  { id: 'corners', name: 'Corners and bridges', icon: '🌉', what: 'Short sentences: “turn right at the second corner”', fn: lessonCorners },
  { id: 'follow', name: 'Follow the way', icon: '🚶', what: 'A whole route, one sentence at a time', fn: lessonFollow },
  { id: 'challenge', name: 'Where will we end up?', icon: '🏁', what: 'Hear the whole route, then find the spot', fn: lessonChallenge },
];
const DEF = { key: 'directions', lessons: LESSONS, back: (ctx) => showStreets(ctx), allDone: 'All direction lessons done! You can find your way around town.' };

export function showStreets(ctx) {
  const map = streetMap();
  map.root.classList.add('preview');
  ctx.screen('town-family town-streets',
    el('div', { class: 'topline' }, ctx.backBtn(() => ctx.showTown(), 'Town'), el('h2', {}, 'The streets ', el('span', { class: 'kana' }, 'みち'))),
    el('div', { class: 'family-body' }, el('div', { class: 'family-left' }, el('div', { class: 'map-preview' }, map.root)), lessonList(ctx, DEF)));
}
export { topic };
