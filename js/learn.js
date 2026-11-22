// Learning model: every hiragana walks its own path.
//   👀 Meet → ✍️ Trace → 🖍️ Copy → 👂 Hear it → 🔍 Read it → ✏️ Write it → 🍣 Use it → ⭐ Master
// Why this order (see README): a picture-supported first meeting, a short tracing bridge,
// then free handwriting with a model (builds letter recognition), then cued recognition
// (hear → find, then see → say), then recall (write from memory), then words. Master needs
// correct answers on 3 separate days, because spaced practice is what makes it stick.
import { KANA, ROWS } from './data.js';
import { save } from './store.js';
import { WORDS } from './vocab.js';

export const STEPS = [
  { id: 'meet', icon: '👀', name: 'Meet', need: 1 },
  { id: 'trace', icon: '✍️', name: 'Trace', need: 3 },
  { id: 'copy', icon: '🖍️', name: 'Copy', need: 2 },
  { id: 'hear', icon: '👂', name: 'Hear it', need: 5 },
  { id: 'read', icon: '🔍', name: 'Read it', need: 5 },
  { id: 'write', icon: '✏️', name: 'Write it', need: 3 },
  { id: 'use', icon: '🍣', name: 'Use it', need: 4 },
  { id: 'master', icon: '⭐', name: 'Master', need: 3 },
];
export const S = Object.fromEntries(STEPS.map((s, i) => [s.id, i])); // S.hear === 3
export const MASTERED = STEPS.length; // step index 8 = mastered

const byH = Object.fromEntries(KANA.map((k) => [k.h, k]));
export const kana = (h) => byH[h];

let i = 0;
export const ROW_CHARS = ROWS.map((r) => {
  const chars = KANA.slice(i, i + r.size).map((k) => k.h);
  i += r.size;
  return { ...r, chars };
});
export const rowOf = (h) => ROW_CHARS.find((r) => r.chars.includes(h));
const today = () => new Date().toDateString();

export function charState(p, h) {
  let c = p.chars[h];
  if (!c) c = p.chars[h] = { hear: 0, read: 0, write: 0, intro: 0, last: 0, seen: 0, step: 0, prog: 0 };
  if (c.step === undefined) migrate(c);
  return c;
}
// Saves from before the path system: place each character on the path from its old scores.
function migrate(c) {
  c.read = c.read || 0;
  c.prog = 0;
  c.cnt = {};
  if (!c.intro) { c.step = 0; return; }
  const m = 0.5 * (c.hear || 0) + 0.5 * (c.write || 0);
  c.step = m < 0.25 ? 1 : m < 0.4 ? 2 : m < 0.55 ? 3 : m < 0.7 ? 4 : m < 0.8 ? 5 : m < 0.9 ? 6 : 7;
  STEPS.slice(0, c.step).forEach((st) => { c.cnt[st.id] = st.need; });
  if (c.step === MASTERED - 1) { c.masterStart = today(); c.masterDays = []; c.prog = 1; }
}
export const isIntroduced = (p, h) => !!(p.chars[h] && p.chars[h].intro);
export const stepOf = (p, h) => (isIntroduced(p, h) ? charState(p, h).step : 0);

// 0..1 along the whole path (used for picking weak characters and progress rings).
export function mastery(p, h) {
  if (!isIntroduced(p, h)) return 0;
  const c = charState(p, h);
  if (c.step >= MASTERED) return 1;
  return (c.step + Math.min(1, (c.prog || 0) / STEPS[c.step].need)) / MASTERED;
}

// Someone (the Session) can listen for step-ups to celebrate them.
let stepListener = null;
export function onStepUp(fn) { stepListener = fn; }

// Record one answer.
// skill: 'trace' | 'copy' | 'hear' | 'read' | 'write' | 'use'
// correct: true only for a first-try success (games pass that in).
const BUCKET = { trace: 'write', copy: 'write', write: 'write', hear: 'hear', read: 'read', use: 'read' };
export function record(p, h, skill, correct, gain = 0.15) {
  const c = charState(p, h);
  const b = BUCKET[skill] || 'hear';
  c[b] = correct ? c[b] + (1 - c[b]) * gain : c[b] * 0.85;
  c.last = Date.now();
  c.seen++;
  if (correct && c.intro) advance(p, h, c, skill);
  save();
}
// Correct answers are banked per skill, so practice done "early" still counts: when a child
// passes Copy, Hear-it answers they already gave move them on straight away. The order of the
// path is kept (a step can only be passed once the step before it is done).
function advance(p, h, c, skill) {
  c.cnt = c.cnt || {};
  if (skill in BUCKET) c.cnt[skill] = (c.cnt[skill] || 0) + 1;
  const d = today();
  while (c.step < MASTERED) {
    const step = STEPS[c.step];
    if (step.id === 'master') {
      c.masterDays = c.masterDays || [];
      if (d !== c.masterStart && !c.masterDays.includes(d)) c.masterDays.push(d);
      c.prog = 1 + c.masterDays.length;
      if (c.prog < step.need) return;
    } else {
      c.prog = Math.min(step.need, c.cnt[step.id] || 0);
      if (c.prog < step.need) return;
    }
    const from = c.step;
    c.step++;
    c.prog = 0;
    if (STEPS[c.step] && STEPS[c.step].id === 'master') { c.masterStart = d; c.masterDays = []; c.prog = 1; }
    else if (STEPS[c.step]) c.prog = Math.min(STEPS[c.step].need, c.cnt[STEPS[c.step].id] || 0);
    stepListener && stepListener({ h, from, to: c.step });
    if (STEPS[c.step] && STEPS[c.step].id === 'master') return; // ⭐ always starts fresh on a new day
  }
}

export function introduce(p, h) {
  const c = charState(p, h);
  if (!c.intro) { c.intro = Date.now(); c.step = S.trace; c.cnt = c.cnt || {}; c.prog = Math.min(STEPS[S.trace].need, c.cnt.trace || 0); }
  save();
}

export const introduced = (p) => KANA.map((k) => k.h).filter((h) => isIntroduced(p, h));

// ---------------- Pairs and levels ----------------
// Hiragana are learned two at a time (あい, うえ, お …), one row at a time. Each pair climbs
// three levels; a level is passed when its characters have done the practice it needs AND
// the child passes a short level check. Later levels mix in more hiragana: Level 2 uses the
// pairs learned so far in the row, Level 3 brings back earlier rows too.
export const LEVELS = [
  null,
  { n: 1, medal: 'Bronze', name: 'Meet & Write', icon: '✍️', need: S.hear },    // past Trace + Copy
  { n: 2, medal: 'Silver', name: 'Hear & Read', icon: '👂', need: S.write },    // past Hear it + Read it
  { n: 3, medal: 'Gold', name: 'Use & Mix', icon: '🍣', need: S.master },        // past Write it + Use it
];
export const UNITS = ROW_CHARS.flatMap((r, ri) => {
  const out = [];
  for (let k = 0; k < r.chars.length; k += 2) {
    out.push({ id: `${r.id}${k / 2}`, row: ri, chars: r.chars.slice(k, k + 2), last: k + 2 >= r.chars.length });
  }
  return out;
});
export const unitOf = (h) => UNITS.find((u) => u.chars.includes(h));
export const rowUnits = (ri) => UNITS.filter((u) => u.row === ri);

// Saves from before levels: each pair gets the level its characters' path steps already show.
export function ensureUnits(p) {
  if (p.units) return p.units;
  p.units = {};
  for (const u of UNITS) {
    const lv = Math.min(...u.chars.map((h) => {
      if (!isIntroduced(p, h)) return 0;
      const st = stepOf(p, h);
      return st >= LEVELS[3].need ? 3 : st >= LEVELS[2].need ? 2 : st >= LEVELS[1].need ? 1 : 0;
    }));
    if (lv) p.units[u.id] = lv;
  }
  save();
  return p.units;
}
export const unitLevel = (p, u) => (ensureUnits(p)[u.id] || 0);
// The pair being learned now: the first one that hasn't reached Level 3. null = all done.
export const currentUnit = (p) => UNITS.find((u) => unitLevel(p, u) < 3) || null;

// Has the practice for this level been done? (The level check still has to be passed.)
// Level 3 doesn't wait for word practice that isn't possible yet: with fewer than two
// playable words for a character, passing Write it is enough (Use it carries on later).
export function levelReady(p, u, level) {
  const need = LEVELS[level].need;
  return u.chars.every((h) => {
    if (!isIntroduced(p, h)) return false;
    const st = stepOf(p, h);
    if (st >= need) return true;
    if (level === 3 && st >= S.use) return wordsWith(introduced(p), h).length < 2;
    return false;
  });
}
export function levelUp(p, u) {
  const lv = Math.min(3, unitLevel(p, u) + 1);
  p.units[u.id] = lv;
  save();
  return lv;
}

// The next row opens when every pair in the row before has reached Level 3 (gold).
export function rowUnlocked(p, rowIndex) {
  return rowIndex === 0 || rowComplete(p, rowIndex - 1);
}
export function rowComplete(p, rowIndex) {
  return rowUnits(rowIndex).every((u) => unitLevel(p, u) >= 3);
}

// New characters for the next adventure: the current pair, if it hasn't been met yet.
export function newCharsForSession(p) {
  const u = currentUnit(p);
  return u ? u.chars.filter((h) => !isIntroduced(p, h)) : [];
}
// Characters to bring back for review: the weakest and longest-unseen first.
export function reviewChars(p, chars, n) {
  const now = Date.now();
  const score = (h) => {
    const c = p.chars[h] || { last: 0 };
    const days = c.last ? Math.min((now - c.last) / 864e5, 7) : 7;
    return (1.1 - mastery(p, h)) * (1 + days * 0.3) + Math.random() * 0.4;
  };
  return chars.map((h) => [score(h), h]).sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
}
const wordsWith = (pool, h) => playableWords(pool, { max: 4 }).filter((w) => w.w.includes(h));

// Weighted pick of practice targets. `only` restricts targets (Dojo picks, single-character practice).
export function pickTargets(p, pool, n, boost = [], only = null) {
  const cand = only && only.length ? only : pool;
  // Chosen characters (Dojo picks, or a hand-picked list): every one comes up once, in a
  // shuffled order, before any repeats. The list's order says which come first when not all fit.
  const cover = only && only.length ? shuffle(only.slice(0, n)) : [];
  if (cover.length >= n) return cover;
  const now = Date.now();
  const weights = cand.map((h) => {
    const c = p.chars[h] || { last: 0 };
    const days = c.last ? Math.min((now - c.last) / 864e5, 7) : 7;
    let w = (1.15 - mastery(p, h)) * (1 + days * 0.25);
    if (boost.includes(h)) w *= 2.5;
    return Math.max(w, 0.05);
  });
  const out = [...cover];
  let last = cover.length ? cover[cover.length - 1] : null;
  cover.forEach((h) => { weights[cand.indexOf(h)] *= 0.55; });
  for (let k = cover.length; k < n; k++) {
    let total = 0;
    const ws = weights.map((w, j) => (cand[j] === last && cand.length > 1 ? 0 : w));
    ws.forEach((w) => (total += w));
    let r = Math.random() * total;
    let j = 0;
    for (; j < ws.length - 1; j++) { r -= ws[j]; if (r <= 0) break; }
    out.push(cand[j]);
    last = cand[j];
    weights[j] *= 0.55;
  }
  return out;
}

const LOOKALIKE = [
  ['あ', 'お', 'め', 'ぬ'], ['ぬ', 'め'], ['ね', 'れ', 'わ'], ['き', 'さ', 'ち'], ['さ', 'ち'],
  ['は', 'ほ', 'け'], ['る', 'ろ'], ['い', 'り', 'こ'], ['こ', 'に'], ['う', 'つ', 'ら'],
  ['く', 'へ', 'し'], ['た', 'な'], ['ま', 'も', 'よ'], ['す', 'お'], ['そ', 'て'],
];
export function lookalikePairs(pool, only = null) {
  const set = new Set(pool);
  const out = new Map();
  for (const g of LOOKALIKE) {
    const known = g.filter((h) => set.has(h));
    for (let a = 0; a < known.length; a++) {
      for (let b = a + 1; b < known.length; b++) {
        if (only && only.length && !only.includes(known[a]) && !only.includes(known[b])) continue;
        out.set([known[a], known[b]].sort().join(''), [known[a], known[b]]);
      }
    }
  }
  return [...out.values()];
}
export function distractors(target, pool, n, preferLookalike = true) {
  const others = pool.filter((h) => h !== target);
  const look = preferLookalike ? shuffle(others.filter((h) => LOOKALIKE.some((g) => g.includes(target) && g.includes(h)))) : [];
  const rest = shuffle(others.filter((h) => !look.includes(h)));
  return [...look, ...rest].slice(0, n);
}
export function shuffle(a) {
  a = a.slice();
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
}

// Trophies follow the levels: bronze = Level 1, silver = Level 2, gold = Level 3.
export function trophyLevelNow(p, h) {
  if (!isIntroduced(p, h)) return 0;
  return unitLevel(p, unitOf(h));
}
export function updateTrophies(p) {
  const earned = [];
  for (const k of KANA) {
    const now = trophyLevelNow(p, k.h);
    const had = p.trophies[k.h] || 0;
    if (now > had) { p.trophies[k.h] = now; earned.push({ h: k.h, level: now }); }
  }
  const rows = [];
  ROW_CHARS.forEach((r, idx) => {
    if (!p.rowTrophies[r.id] && rowComplete(p, idx)) { p.rowTrophies[r.id] = true; rows.push(r); }
  });
  save();
  return { earned, rows };
}

// How a character is written in Trace practice, from its path step.
// Returns { level, mode }: level 0 = full guide, 1 = faded, 2 = start dots, 3 = from memory.
// mode: 'trace' | 'copy' (model shown beside an empty pad) | 'write'
export function writingMode(p, h) {
  const c = charState(p, h);
  if (c.step <= S.trace) return { level: c.prog >= 1 ? 1 : 0, mode: 'trace' };
  if (c.step === S.copy) return { level: 3, mode: 'copy' };
  if (c.step < S.write) return { level: 2, mode: 'write' };
  return { level: 3, mode: 'write' };
}

export function playableWords(pool, { min = 2, max = 5 } = {}) {
  const set = new Set(pool);
  return WORDS.filter((w) => w.w.length >= min && w.w.length <= max && [...w.w].every((c) => set.has(c)));
}
