// A play session: top bar (progress stones + streak lanterns), streak celebrations,
// and the adventure planner that strings games together.
import { said, el, mochi, petals, icon, wait, toast, overlay, keepAwake } from './ui.js';
import { safeScreen } from './update.js';
import { countAnswer, addCoins, EARN, balance } from './wardrobe.js';
import { kobanPill } from './ui.js';
import * as A from './audio.js';
import { introduced, updateTrophies, playableWords, onStepUp, stepOf, S, STEPS, MASTERED, isIntroduced, ensureUnits, currentUnit, unitLevel, rowUnits, reviewChars } from './learn.js';
import { save } from './store.js';

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export class Session {
  constructor({ profile, root, steps = 1, onExit }) {
    this.p = profile;
    this.streak = 0;
    this.lanterns = 0;
    this.correctCount = 0;
    this.missCount = 0;
    this.practiced = {};
    this.exited = false;
    this.onExit = onExit;
    this.steps = steps;
    this.step = 0;
    this.climbed = [];   // path steps climbed this session: { h, from, to }
    onStepUp((e) => this.stepUp(e));

    this.mini = mochi('idle', 'sm');
    this.stones = el('div', { class: 'stones' });
    this.lanternBar = el('div', { class: 'lantern-bar', 'aria-label': 'streak lanterns' });
    for (let i = 0; i < 5; i++) this.lanternBar.append(el('span', { class: 'lamp' }));
    const homeBtn = el('button', { class: 'icon-btn', 'aria-label': 'Leave', html: icon('home') });
    homeBtn.addEventListener('click', () => this.askExit());
    this.coinsEarned = 0;
    this.coinPill = kobanPill(balance(profile), 'game');
    this.top = el('header', { class: 'game-top' }, homeBtn, this.stones, this.coinPill, this.lanternBar, this.mini);
    this.stage = el('main', { class: 'stage' });
    this.node = el('div', { class: 'screen game-screen' }, this.top, this.stage);
    root.replaceChildren(this.node);
    this.renderStones();
    keepAwake(true);
    safeScreen(false); // never update in the middle of a game
  }

  renderStones() {
    this.stones.replaceChildren(
      ...Array.from({ length: this.steps }, (_, i) =>
        el('span', { class: 'stone' + (i < this.step ? ' done' : i === this.step ? ' here' : '') })),
    );
  }
  nextStep() { this.step++; this.renderStones(); }
  addSteps(n) { this.steps += n; this.renderStones(); }

  // Clear the stage and put a fresh game view into it.
  view(cls, ...children) {
    const v = el('div', { class: `view ${cls}` }, ...children);
    this.stage.replaceChildren(v);
    return v;
  }

  // A koban was earned: the counter in the top bar gives a small bump and a soft clink.
  earned(n) {
    if (!n) return;
    this.coinsEarned += n;
    this.coinPill.querySelector('b').textContent = balance(this.p);
    this.coinPill.classList.remove('bump'); void this.coinPill.offsetWidth; this.coinPill.classList.add('bump');
    setTimeout(() => A.clink(), 250);
  }
  // prof: who answered (two-player Karuta credits the winner; a guest earns nothing).
  correct(h, prof = this.p) {
    if (prof) { const n = countAnswer(prof); if (prof === this.p) this.earned(n); }
    this.streak++;
    this.correctCount++;
    if (h) this.practiced[h] = (this.practiced[h] || 0) + 1;
    if (this.streak > (this.p.bestStreak || 0)) { this.p.bestStreak = this.streak; save(); }
    if (this.streak % 5 === 0) {
      const big = this.streak % 10 === 0;
      this.lanterns = Math.min(5, this.lanterns + 1);
      [...this.lanternBar.children].forEach((l, i) => l.classList.toggle('lit', i < this.lanterns));
      const lamp = this.lanternBar.children[this.lanterns - 1];
      lamp && (lamp.classList.remove('glow'), void lamp.offsetWidth, lamp.classList.add('glow'));
      A.chime(big ? 2 : 1);
      petals(big ? 18 : 12);
      this.mini.setMood('happy');
      this.mini.hop();
      setTimeout(() => this.mini.setMood('idle'), 1600);
      A.say(big ? 'streak10' : 'streak5', { gap: 700 });
      toast(el('span', { class: 'streak-toast said' }, ...said(big ? 'streak10' : 'streak5', `${this.streak} in a row!`)), 1600);
    } else {
      A.chime(0);
    }
  }
  // A character moved one stone along its path: a small, calm moment.
  stepUp({ h, from, to }) {
    this.climbed.push({ h, from, to });
    this.earned(addCoins(this.p, to >= MASTERED ? EARN.master : EARN.step));
    const st = STEPS[to];
    const label = to >= MASTERED ? 'Mastered!' : `${st.icon} ${st.name}`;
    setTimeout(() => {
      A.chime(1);
      toast(el('span', { class: 'step-toast' }, el('span', { class: 'kana' }, h), ' → ', label), 2200);
      this.mini.setMood('happy'); this.mini.hop();
      setTimeout(() => this.mini.setMood('idle'), 1600);
    }, 700);
  }
  end() { onStepUp(null); }
  // Practice that doesn't count as an answer (Memory matches): no streak change, no koban.
  practise(h) {
    if (h) this.practiced[h] = (this.practiced[h] || 0) + 1;
    A.chime(0);
  }
  miss(h) {
    // Quiet reset. No sad sounds, no "streak lost" message.
    this.streak = 0;
    this.missCount++;
    if (h) this.practiced[h] = (this.practiced[h] || 0) + 1;
    A.tok();
  }

  askExit() {
    const box = el('div', { class: 'modal-back' },
      el('div', { class: 'modal' },
        mochi('idle', 'md'),
        el('p', { class: 'modal-text' }, 'Want to stop here?'),
        el('div', { class: 'row-btns' },
          el('button', { class: 'btn soft', onclick: () => box.remove() }, 'Keep playing'),
          el('button', { class: 'btn', onclick: () => { box.remove(); this.exited = true; this.end(); this.onExit && this.onExit(); } }, 'Stop'),
        )));
    overlay().append(box);
  }
}

// Throw this to abort a game when the player leaves mid-way.
export class ExitError extends Error {}
export function guard(s) { if (s.exited) throw new ExitError(); }

// ---------------- Adventure planning ----------------
// One pair at a time (あい, うえ, お …), one row at a time. An adventure works on the current
// pair's level, opens with a short warm-up from earlier pairs, and ends with the level check
// when the level's practice is done. Later levels mix in more hiragana:
//   Level 1 · Meet & Write — only the new pair: meet, trace, copy, hear it (2 choices)
//   Level 2 · Hear & Read  — the pair among the row so far: listen, goldfish, detective, spot, memory
//   Level 3 · Use & Mix    — write from memory, words, and earlier rows mixed in (about a third)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function planAdventure(p) {
  ensureUnits(p);
  const u = currentUnit(p);
  if (!u) return planReview(p);
  const target = unitLevel(p, u) + 1;
  return { ...planLevel(p, u, target, { warmup: true }), unit: u, target };
}

// The games for one level of one pair (also used when a child earns a second level in one go).
export function planLevel(p, u, target, { warmup = false } = {}) {
  const fresh = u.chars.filter((h) => !isIntroduced(p, h));
  const known = [...new Set([...introduced(p), ...fresh])];
  const rowSoFar = rowUnits(u.row).flatMap((x) => x.chars).filter((h) => known.includes(h));
  const others = known.filter((h) => !u.chars.includes(h));
  const near = rowSoFar.length >= 2 ? rowSoFar : known;
  const steps = [];

  // Warm-up: a minute with earlier hiragana (the か row keeps the あ row fresh).
  if (warmup && others.length >= 2) {
    const r = reviewChars(p, others, Math.min(4, others.length));
    steps.push({ type: pick(['listen', 'detective']), only: r, pool: known, count: r.length });
  }
  fresh.forEach((h) => steps.push({ type: 'meet', h }));

  if (target === 1) {
    // Writing rounds still needed for Trace (3) + Copy (2) per character, meeting gives 2.
    const left = u.chars.reduce((a, h) => {
      const c = p.chars[h] || {}; const cnt = (c.cnt || {});
      const tr = fresh.includes(h) ? 2 : (cnt.trace || 0);
      return a + Math.max(0, 3 - tr) + Math.max(0, 2 - (cnt.copy || 0));
    }, 0);
    steps.push({ type: 'trace', only: u.chars, pool: u.chars, count: Math.max(2, Math.min(6, left)) });
    steps.push({ type: 'listen', only: u.chars, pool: u.chars.length > 1 ? u.chars : near, count: 6 });
    if (!fresh.length) steps.push({ type: 'goldfish', only: u.chars, pool: near, count: 6 });
  } else if (target === 2) {
    steps.push({ type: pick(['listen', 'goldfish']), boost: u.chars, pool: near, count: 6 });
    steps.push({ type: pick(['detective', 'spot']), boost: u.chars, pool: near, count: 5 });
    steps.push({ type: 'trace', only: u.chars, pool: u.chars, count: u.chars.length });
    steps.push(near.length >= 3 ? { type: pick(['memory', 'detective', 'goldfish']), boost: u.chars, pool: near, count: 5 } : { type: 'listen', boost: u.chars, pool: near, count: 5 });
  } else {
    const words = playableWords(known, { max: 4 }).filter((w) => u.chars.some((h) => w.w.includes(h)));
    steps.push({ type: pick(['picwrite', 'dictation']), only: u.chars, pool: known, count: 3 });
    if (words.length) steps.push({ type: pick(words.length >= 3 ? ['sushi', 'readmatch', 'river'] : ['sushi']), only: u.chars, pool: known, count: 3 });
    // Mix: the pair together with earlier hiragana (about a third of the questions).
    const mix = [...u.chars, ...reviewChars(p, others, 3)];
    steps.push({ type: pick(known.length >= 4 ? ['spot', 'detective', 'karuta', 'goldfish'] : ['detective', 'listen']), only: mix, pool: known, count: mix.length + 1 });
    if (words.length >= 3) steps.push({ type: pick(['readmatch', 'river']), only: u.chars, pool: known, count: 3 });
    else steps.push({ type: 'dictation', only: u.chars, pool: known, count: 2 });
  }
  steps.push({ type: 'check', unitId: u.id, level: target });
  return { fresh, pool: known, steps };
}

// Everything is gold: mixed review, weakest hiragana first.
function planReview(p) {
  const known = introduced(p);
  const weak = reviewChars(p, known, 6);
  const steps = [
    { type: pick(['listen', 'detective']), only: weak.slice(0, 4), count: 4 },
    { type: pick(['picwrite', 'dictation']), only: weak.slice(0, 3), count: 3 },
    { type: pick(['sushi', 'readmatch', 'river']), boost: weak, count: 3 },
    { type: pick(['karuta', 'spot', 'goldfish', 'memory']), boost: weak, count: 5 },
  ];
  return { fresh: [], pool: known, steps };
}

export function finishSession(p, s, fresh) {
  const { earned, rows } = updateTrophies(p);
  const top = Object.entries(s.practiced).sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const stampChar = fresh[0] || top[0] || 'あ';
  p.stamps.push({ date: Date.now(), h: stampChar, chars: [...new Set([...fresh, ...top.slice(0, 4)])] });
  save();
  s.earned(addCoins(p, EARN.adventure + rows.length * EARN.row));
  s.end();
  return { earned, rows, stampChar, climbed: s.climbed, coins: s.coinsEarned };
}

export { wait };
