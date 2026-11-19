// Finger-tracing pad. Checks every stroke against KanjiVG templates for shape,
// start point, direction and order. Lenient on purpose: kids' strokes wobble.
//
// Help levels: 0 = full guide + start dot + arrow, 1 = faded guide + start dot,
//              2 = start dot only, 3 = from memory (checked after the last stroke).
import { STROKES } from './data.js';
import { el, wait, icon } from './ui.js';

const U = 109; // KanjiVG coordinate space
const N = 24;  // resample points
const INK = '#2b3a67';
const GUIDE = '#cfc8e0';
const DONE = '#2b3a67';
const DEMO = '#e4572e';

let measureSvg = null;
const cache = new Map();

function samplePath(d) {
  if (!measureSvg) {
    measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    measureSvg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden');
    document.body.append(measureSvg);
  }
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  measureSvg.append(p);
  const len = p.getTotalLength();
  const pts = [];
  const n = Math.max(8, Math.ceil(len / 1.5));
  for (let i = 0; i <= n; i++) {
    const q = p.getPointAtLength((len * i) / n);
    pts.push({ x: q.x, y: q.y });
  }
  p.remove();
  return { pts, len };
}

export function template(h) {
  if (!cache.has(h)) {
    cache.set(h, STROKES[h].map((d) => ({ d, path: new Path2D(d), ...samplePath(d) })));
  }
  return cache.get(h);
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function pathLen(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}
function resample(pts, n = N) {
  const total = pathLen(pts);
  if (total === 0) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const step = total / (n - 1);
  const out = [{ ...pts[0] }];
  let acc = 0;
  let prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    let cur = pts[i];
    let d = dist(prev, cur);
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d;
      const q = { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t };
      out.push(q);
      prev = q;
      d = dist(prev, cur);
      acc = 0;
    }
    acc += d;
    prev = cur;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out;
}

// Compare one drawn stroke to one template stroke (both in KanjiVG units).
function compare(user, tmpl, tol) {
  const u = resample(user);
  const t = resample(tmpl.pts);
  let mean = 0, rev = 0;
  for (let i = 0; i < N; i++) {
    mean += dist(u[i], t[i]);
    rev += dist(u[i], t[N - 1 - i]);
  }
  mean /= N; rev /= N;
  const start = dist(u[0], t[0]);
  const end = dist(u[N - 1], t[N - 1]);
  const ratio = pathLen(user) / Math.max(tmpl.len, 1);
  // Very short strokes (dots, ticks) get extra room for their ends.
  const endTol = tol.end + (tmpl.len < 12 ? 6 : 0);
  // Overall direction must agree (catches reversed short ticks, which are otherwise too small to tell).
  const dot = (u[N - 1].x - u[0].x) * (t[N - 1].x - t[0].x) + (u[N - 1].y - u[0].y) * (t[N - 1].y - t[0].y);
  const sameWay = tmpl.len < 6 || dot > 0;
  const ok = sameWay && mean < tol.mean && start < endTol && end < endTol && ratio > 0.4 && ratio < 2.2;
  const reversed = !ok && rev < tol.mean && ratio > 0.4 && ratio < 2.2;
  return { ok, reversed, mean, quality: Math.max(0, 1 - mean / tol.mean) };
}

const TOL = [
  { mean: 11, end: 15 },
  { mean: 12, end: 16 },
  { mean: 13, end: 17 },
  { mean: 14, end: 19 },
];

/**
 * createTracePad({ h, level, onStroke(ok, info), onDone(result) })
 * result: { quality 0..1, misses, assisted, level }
 */
export function createTracePad({ h, level = 0, onStroke = () => {}, onDone = () => {} }) {
  const strokes = template(h);
  window.__lastTraceChar = h; // used by automated tests
  const guide = el('canvas', { class: 'tp-guide' });
  const ink = el('canvas', { class: 'tp-ink' });
  const pad = el('div', { class: 'trace-pad' }, guide, ink);
  const gctx = guide.getContext('2d');
  const ictx = ink.getContext('2d');

  let size = 300, dpr = 1;
  let idx = 0;                // current stroke index
  let accepted = [];          // stroke indexes accepted (levels 0-2) / drawn user strokes (level 3)
  let freeStrokes = [];       // level 3: user strokes in KanjiVG units
  let misses = 0, missesHere = 0, quality = [];
  let assisted = false;
  let curLevel = level;
  let drawing = null;
  let busy = false;
  let done = false;
  let demoToken = 0;      // bumping this cancels a running demo
  let demoRunning = false;

  function resize() {
    const r = pad.getBoundingClientRect();
    if (!r.width) return;
    size = r.width;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    for (const c of [guide, ink]) {
      c.width = Math.round(size * dpr);
      c.height = Math.round(size * dpr);
    }
    drawGuide();
    redrawInk();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(pad);
  // The stage is scaled with a transform, which ResizeObserver doesn't see.
  const onWin = () => requestAnimationFrame(resize);
  window.addEventListener('resize', onWin);

  const setT = (ctx) => ctx.setTransform((size * dpr) / U, 0, 0, (size * dpr) / U, 0, 0);

  function drawGuide(highlight = null) {
    const c = gctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, guide.width, guide.height);
    setT(c);
    // Practice-paper cross
    c.save();
    c.strokeStyle = '#e6dccb';
    c.lineWidth = 0.6;
    c.setLineDash([2.5, 2.5]);
    c.beginPath(); c.moveTo(U / 2, 4); c.lineTo(U / 2, U - 4); c.moveTo(4, U / 2); c.lineTo(U - 4, U / 2); c.stroke();
    c.restore();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (curLevel <= 1) {
      c.globalAlpha = curLevel === 0 ? 1 : 0.4;
      strokes.forEach((s, i) => {
        c.strokeStyle = curLevel === 0 && i === idx ? '#b9b0d6' : GUIDE;
        c.lineWidth = 8;
        c.stroke(s.path);
      });
      c.globalAlpha = 1;
    }
    if (highlight != null) {
      c.strokeStyle = DEMO;
      c.globalAlpha = 0.35;
      c.lineWidth = 8;
      c.stroke(strokes[highlight].path);
      c.globalAlpha = 1;
    }
    if (curLevel <= 2 && idx < strokes.length && !done) drawStart(c, idx);
  }

  function drawStart(c, i) {
    const s = strokes[i];
    const p0 = s.pts[0];
    const p1 = s.pts[Math.min(5, s.pts.length - 1)];
    c.fillStyle = DEMO;
    c.beginPath(); c.arc(p0.x, p0.y, 3.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.font = '600 4.6px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(i + 1), p0.x, p0.y + 0.3);
    if (curLevel === 0) {
      // little arrow showing direction
      const a = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const ax = p0.x + Math.cos(a) * 9, ay = p0.y + Math.sin(a) * 9;
      c.strokeStyle = DEMO; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(p0.x + Math.cos(a) * 4.5, p0.y + Math.sin(a) * 4.5); c.lineTo(ax, ay); c.stroke();
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(ax - Math.cos(a - 0.6) * 3, ay - Math.sin(a - 0.6) * 3);
      c.moveTo(ax, ay);
      c.lineTo(ax - Math.cos(a + 0.6) * 3, ay - Math.sin(a + 0.6) * 3);
      c.stroke();
    }
  }

  function redrawInk() {
    const c = ictx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, ink.width, ink.height);
    setT(c);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = DONE; c.lineWidth = 7;
    if (curLevel === 3 && !done) {
      for (const s of freeStrokes) polyline(c, s);
    } else {
      for (const i of accepted) c.stroke(strokes[i].path);
    }
    if (drawing) { c.strokeStyle = INK; polyline(c, drawing); }
  }
  function polyline(c, pts) {
    if (!pts.length) return;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    if (pts.length === 1) c.lineTo(pts[0].x + 0.01, pts[0].y);
    c.stroke();
  }

  const toUnits = (e) => {
    const r = ink.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * U, y: ((e.clientY - r.top) / r.height) * U };
  };

  let pid = null;
  ink.addEventListener('pointerdown', (e) => {
    if (busy && demoRunning) { demoToken++; demoRunning = false; busy = false; drawGuide(); }
    if (busy || done || pid !== null) return;
    // Palm rejection: ignore very large touch contacts (a resting hand).
    if (e.pointerType === 'touch' && e.width > 70 && e.height > 70) return;
    e.preventDefault();
    pid = e.pointerId;
    ink.setPointerCapture(pid);
    drawing = [toUnits(e)];
    redrawInk();
  });
  ink.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid || !drawing) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs.length ? evs : [e]) drawing.push(toUnits(ev));
    redrawInk();
  });
  const up = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    const pts = drawing;
    drawing = null;
    if (!pts) return;
    if (pathLen(pts) < 2.5 && !(strokes[idx] && strokes[idx].len < 10)) { redrawInk(); return; } // a tap
    finishStroke(pts);
  };
  ink.addEventListener('pointerup', up);
  ink.addEventListener('pointercancel', up);

  async function finishStroke(pts) {
    if (curLevel === 3) return finishFree(pts);
    const r = compare(pts, strokes[idx], TOL[curLevel]);
    if (r.ok) {
      accepted.push(idx);
      quality.push(r.quality);
      idx++;
      missesHere = 0;
      redrawInk();
      drawGuide();
      onStroke(true, { index: idx - 1, quality: r.quality });
      if (idx >= strokes.length) complete();
      return;
    }
    // Miss: work out a helpful hint.
    misses++; missesHere++;
    let reason = r.reversed ? 'direction' : 'shape';
    for (let j = idx + 1; j < strokes.length; j++) {
      if (compare(pts, strokes[j], TOL[curLevel]).ok) { reason = 'order'; break; }
    }
    redrawInk();
    onStroke(false, { index: idx, reason });
    if (missesHere >= 2 && curLevel > 0) { curLevel = Math.max(0, curLevel - 1); assisted = true; }
    await demoStroke(idx);
    drawGuide();
  }

  function finishFree(pts) {
    freeStrokes.push(pts);
    redrawInk();
    onStroke(true, { index: freeStrokes.length - 1, free: true });
    if (freeStrokes.length >= strokes.length) checkFree();
  }

  async function checkFree() {
    busy = true;
    const all = freeStrokes.flat();
    const tAll = strokes.flatMap((s) => s.pts);
    const bb = (ps) => {
      const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s: Math.max(x1 - x0, y1 - y0, 1) };
    };
    const ub = bb(all), tb = bb(tAll);
    const k = tb.s / ub.s;
    const norm = (p) => ({ x: (p.x - ub.cx) * k + tb.cx, y: (p.y - ub.cy) * k + tb.cy });
    let bad = -1;
    const qs = [];
    for (let i = 0; i < strokes.length; i++) {
      const r = compare(freeStrokes[i].map(norm), strokes[i], TOL[3]);
      if (!r.ok) { bad = i; break; }
      qs.push(r.quality);
    }
    if (bad === -1) {
      quality = qs;
      accepted = strokes.map((_, i) => i);
      done = true;
      // Snap to the neat version so the child sees a beautiful character.
      redrawInk();
      busy = false;
      complete();
      return;
    }
    misses++;
    onStroke(false, { index: bad, reason: 'free' });
    await wait(500);
    freeStrokes = [];
    redrawInk();
    if (misses >= 2) { curLevel = 1; assisted = true; idx = 0; accepted = []; drawGuide(); }
    await demoAll();
    busy = false;
    drawGuide();
  }

  function complete() {
    done = true;
    redrawInk();
    drawGuide();
    pad.classList.add('tp-done');
    const q = quality.length ? quality.reduce((a, b) => a + b, 0) / quality.length : 0.5;
    onDone({ quality: q, misses, assisted, level });
  }

  // Animate one stroke being drawn (demo), on the guide layer.
  async function demoStroke(i, ms = 650) {
    const my = ++demoToken;
    busy = true;
    demoRunning = true;
    const pts = strokes[i].pts;
    const c = gctx;
    const t0 = performance.now();
    await new Promise((res) => {
      const frame = (t) => {
        if (my !== demoToken) { res(); return; }
        const f = Math.min(1, (t - t0) / ms);
        drawGuide();
        setT(c);
        c.strokeStyle = DEMO; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
        c.globalAlpha = 0.85;
        polyline(c, pts.slice(0, Math.max(2, Math.ceil(pts.length * f))));
        c.globalAlpha = 1;
        if (f < 1) requestAnimationFrame(frame); else res();
      };
      requestAnimationFrame(frame);
    });
    if (my !== demoToken) return false;
    await wait(250);
    if (my !== demoToken) return false;
    busy = false;
    demoRunning = false;
    return true;
  }
  async function demoAll() {
    for (let i = 0; i < strokes.length; i++) {
      if (!(await demoStroke(i, 550))) return;
    }
    drawGuide();
  }

  function undo() {
    if (busy || done) return;
    if (curLevel === 3) freeStrokes.pop();
    redrawInk();
  }

  return {
    node: pad,
    demo: async () => { if (busy) return; const was = curLevel; curLevel = Math.min(curLevel, 1); await demoAll(); curLevel = was; drawGuide(); },
    hint: async () => { if (busy || done) return; assisted = true; if (curLevel === 3) { freeStrokes = []; curLevel = 1; idx = 0; accepted = []; } await demoStroke(idx); drawGuide(); },
    undo,
    canUndo: () => curLevel === 3,
    get level() { return curLevel; },
    destroy: () => { ro.disconnect(); window.removeEventListener('resize', onWin); },
  };
}

// Static rendering of a character's strokes into an existing canvas-free SVG (for cards).
export function kanaSVG(h, { color = INK, width = 7, cls = '' } = {}) {
  const paths = STROKES[h].map((d) => `<path d="${d}"/>`).join('');
  return `<svg viewBox="0 0 ${U} ${U}" class="kana-svg ${cls}"><g fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

// Animated stroke-order SVG (CSS dash animation), used on the "meet" screen.
export function animatedKanaSVG(h, { color = INK, width = 7, perStroke = 0.7 } = {}) {
  const t = template(h);
  const paths = t.map((s, i) =>
    `<path d="${s.d}" style="stroke-dasharray:${s.len + 2};stroke-dashoffset:${s.len + 2};animation:draw ${perStroke}s ease-in-out ${i * (perStroke + 0.15)}s forwards"/>`).join('');
  return `<svg viewBox="0 0 ${U} ${U}" class="kana-svg animated"><g fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}
