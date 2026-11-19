// Learning model: per-character mastery, row unlocking, introduction pacing,
// spaced-repetition style picking, and trophies.
import { KANA, ROWS } from './data.js';
import { save } from './store.js';
import { WORDS } from './vocab.js';

export const MASTERED = 0.85;     // a character counts as "done"
export const UNLOCK_NEXT = 0.7;   // row average needed to unlock the next row
export const UNLOCK_EACH = 0.5;   // ...and every char in the row at least this
export const SILVER = 0.5;

const byH = Object.fromEntries(KANA.map((k) => [k.h, k]));
export const kana = (h) => byH[h];

// Row membership, in order.
let i = 0;
export const ROW_CHARS = ROWS.map((r) => {
  const chars = KANA.slice(i, i + r.size).map((k) => k.h);
  i += r.size;
  return { ...r, chars };
});
export const rowOf = (h) => ROW_CHARS.find((r) => r.chars.includes(h));

export function charState(p, h) {
  if (!p.chars[h]) p.chars[h] = { hear: 0, write: 0, intro: 0, last: 0, seen: 0 };
  return p.chars[h];
}
export const isIntroduced = (p, h) => !!(p.chars[h] && p.chars[h].intro);
export function mastery(p, h) {
  const c = p.chars[h];
  if (!c) return 0;
  return 0.5 * c.hear + 0.5 * c.write;
}

// Record an answer. skill: 'hear' | 'write'. gain: how much a correct answer moves the meter.
// Spacing rule: practice on more separate days raises how high a skill can climb.
// Day 1 tops out at 45%, day 2 at 65%, day 3 at 85%, day 4+ at 100%. Cramming can't fake mastery.
export function dayCap(c) { return Math.min(1, 0.45 + 0.2 * Math.max(0, (c.days || 1) - 1)); }
export function record(p, h, skill, correct, gain = 0.2) {
  const c = charState(p, h);
  const today = new Date().toDateString();
  if (c.lastDay !== today) { c.days = (c.days || 0) + 1; c.lastDay = today; }
  if (correct) c[skill] = Math.min(Math.max(c[skill], dayCap(c)), c[skill] + (1 - c[skill]) * gain);
  else c[skill] = c[skill] * 0.8;
  c.last = Date.now();
  c.seen++;
  save();
}

export function introduce(p, h) {
  const c = charState(p, h);
  if (!c.intro) c.intro = Date.now();
  save();
}

export const introduced = (p) => KANA.map((k) => k.h).filter((h) => isIntroduced(p, h));

export function rowUnlocked(p, rowIndex) {
  if (rowIndex === 0) return true;
  const prev = ROW_CHARS[rowIndex - 1];
  if (!prev.chars.every((h) => isIntroduced(p, h) && mastery(p, h) >= UNLOCK_EACH)) return false;
  return prev.chars.reduce((a, h) => a + mastery(p, h), 0) / prev.chars.length >= UNLOCK_NEXT;
}
export function rowComplete(p, rowIndex) {
  return ROW_CHARS[rowIndex].chars.every((h) => mastery(p, h) >= MASTERED);
}

// The next character waiting to be introduced (in an unlocked row), or null.
export function nextNewChar(p) {
  for (let r = 0; r < ROW_CHARS.length; r++) {
    if (!rowUnlocked(p, r)) return null;
    for (const h of ROW_CHARS[r].chars) if (!isIntroduced(p, h)) return h;
  }
  return null;
}

// How many new characters to introduce at the start of an adventure (0-2).
export function newCharsForSession(p) {
  const intro = introduced(p);
  const out = [];
  const take = (n) => {
    // Simulate introducing in order without saving yet.
    const seen = new Set(intro);
    for (let r = 0; r < ROW_CHARS.length && out.length < n; r++) {
      if (!rowUnlocked(p, r)) break;
      for (const h of ROW_CHARS[r].chars) {
        if (out.length >= n) break;
        if (!seen.has(h)) { out.push(h); seen.add(h); }
      }
      // Don't spill into the next row in the same session.
      if (out.length) break;
    }
  };
  if (intro.length < 2) { take(2); return out; }
  const ms = intro.map((h) => mastery(p, h));
  const weakest = Math.min(...ms);
  const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
  if (weakest < 0.3) return [];
  take(avg >= 0.42 ? 2 : 1);
  return out;
}

// Weighted pick of practice targets. Weaker and less-recently-seen chars come up more.
export function pickTargets(p, pool, n, boost = []) {
  const now = Date.now();
  const weights = pool.map((h) => {
    const c = p.chars[h] || { last: 0 };
    const days = c.last ? Math.min((now - c.last) / 864e5, 7) : 7;
    let w = (1.15 - mastery(p, h)) * (1 + days * 0.25);
    if (boost.includes(h)) w *= 2.2;
    return Math.max(w, 0.05);
  });
  const out = [];
  let last = null;
  for (let k = 0; k < n; k++) {
    let total = 0;
    const ws = weights.map((w, j) => (pool[j] === last && pool.length > 1 ? 0 : w));
    ws.forEach((w) => (total += w));
    let r = Math.random() * total;
    let j = 0;
    for (; j < ws.length - 1; j++) { r -= ws[j]; if (r <= 0) break; }
    out.push(pool[j]);
    last = pool[j];
    weights[j] *= 0.55; // spread things out within one game
  }
  return out;
}

// Distractors: prefer look-alikes the child already knows, then others they know.
const LOOKALIKE = [
  ['あ', 'お', 'め', 'ぬ'], ['ぬ', 'め'], ['ね', 'れ', 'わ'], ['き', 'さ', 'ち'], ['さ', 'ち'],
  ['は', 'ほ', 'け'], ['る', 'ろ'], ['い', 'り', 'こ'], ['こ', 'に'], ['う', 'つ', 'ら'],
  ['く', 'へ', 'し'], ['た', 'な'], ['ま', 'も', 'よ'], ['す', 'お'], ['そ', 'て'],
];
// All look-alike pairs where the child knows both characters.
export function lookalikePairs(pool) {
  const set = new Set(pool);
  const out = new Map();
  for (const g of LOOKALIKE) {
    const known = g.filter((h) => set.has(h));
    for (let i = 0; i < known.length; i++) {
      for (let j = i + 1; j < known.length; j++) {
        const key = [known[i], known[j]].sort().join('');
        out.set(key, [known[i], known[j]]);
      }
    }
  }
  return [...out.values()];
}
export function distractors(target, pool, n, preferLookalike = true) {
  const others = pool.filter((h) => h !== target);
  const look = preferLookalike
    ? shuffle(others.filter((h) => LOOKALIKE.some((g) => g.includes(target) && g.includes(h))))
    : [];
  const rest = shuffle(others.filter((h) => !look.includes(h)));
  return [...look, ...rest].slice(0, n);
}

export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Trophy levels. Returns list of newly earned { h, level } and rows completed.
export function trophyLevelNow(p, h) {
  if (!isIntroduced(p, h)) return 0;
  const r = ROW_CHARS.indexOf(rowOf(h));
  if (rowComplete(p, r)) return 3;
  if (mastery(p, h) > SILVER) return 2;
  return 1;
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

// Level of tracing help, from the write skill.
// 0 = full guide + arrows, 1 = faded guide, 2 = start dots only, 3 = from memory
export function traceLevel(p, h) {
  const w = (p.chars[h] || {}).write || 0;
  if (w < 0.25) return 0;
  if (w < 0.5) return 1;
  if (w < 0.72) return 2;
  return 3;
}

// Words whose every character the child already knows.
export function playableWords(pool, { min = 2, max = 5 } = {}) {
  const set = new Set(pool);
  return WORDS.filter((w) => w.w.length >= min && w.w.length <= max && [...w.w].every((c) => set.has(c)));
}
