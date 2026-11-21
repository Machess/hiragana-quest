// A play session: top bar (progress stones + streak lanterns), streak celebrations,
// and the adventure planner that strings games together.
import { el, mochi, petals, icon, wait, toast, overlay, keepAwake } from './ui.js';
import { safeScreen } from './update.js';
import { countAnswer, addCoins, EARN, balance } from './wardrobe.js';
import { kobanPill } from './ui.js';
import * as A from './audio.js';
import { introduced, newCharsForSession, updateTrophies, playableWords, onStepUp, stepOf, S, STEPS, MASTERED } from './learn.js';
import { save } from './store.js';

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export class Session {
  constructor({ profile, root, steps = 1, onExit }) {
    this.p = profile;
    this.streak = 0;
    this.lanterns = 0;
    this.correctCount = 0;
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
      toast(el('span', { class: 'streak-toast' }, `${this.streak} in a row!`), 1600);
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
  miss(h) {
    // Quiet reset. No sad sounds, no "streak lost" message.
    this.streak = 0;
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
// Every character gets the kind of practice its path step asks for, in a calm 8–10 minute session.
export function planAdventure(p) {
  const fresh = newCharsForSession(p);
  const pool = [...new Set([...introduced(p), ...fresh])];
  const st = (h) => (fresh.includes(h) ? S.trace : stepOf(p, h));
  const at = (lo, hi = lo) => pool.filter((h) => st(h) >= lo && st(h) <= hi);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const words = playableWords(pool).length;
  const steps = fresh.map((h) => ({ type: 'meet', h }));
  const games = [];

  // ✍️🖍️ Hand: tracing and copying for characters at those steps.
  const hand = at(S.trace, S.copy);
  if (hand.length) games.push({ type: 'trace', only: hand.slice(0, 3), count: Math.min(3, hand.length) });

  // 👂 Hear it: new and hear-step characters come up most.
  const hearBoost = [...fresh, ...at(S.hear)];
  const hearGames = [{ type: 'listen', count: 6 }, { type: 'goldfish', count: 6 }];
  if (!fresh.length && pool.length >= 4) hearGames.push({ type: 'karuta' });
  if (!fresh.length && words >= 3) hearGames.push({ type: 'river', count: 2 });
  games.push({ ...(fresh.length ? hearGames[0] : pick(hearGames)), boost: hearBoost });

  // 🔍 Read it
  if (pool.length >= 3 && (at(S.read).length || at(S.write, MASTERED).length)) {
    games.push({ ...pick([{ type: 'detective', count: 5 }, { type: 'spot', count: 4 }]), boost: at(S.read) });
  }
  // ✏️ Write it (from memory for write-step characters, with start dots for those just past Copy)
  if (at(S.hear, MASTERED).length) {
    games.push({ ...pick([{ type: 'picwrite', count: 3 }, { type: 'dictation', count: 3 }]), boost: at(S.write) });
  }
  // 🍣 Use it
  if (words >= 2 && at(S.read, MASTERED).length) {
    games.push({ ...pick([{ type: 'sushi', count: 3 }, { type: 'readmatch', count: 4 }, { type: 'river', count: 2 }]), boost: at(S.use) });
  }
  // A playful bonus when there is room.
  const max = fresh.length ? 4 : 6;
  if (games.length < max) {
    const used = new Set(games.map((g) => g.type));
    const bonus = [{ type: 'memory' }];
    if (pool.length >= 4) bonus.push({ type: 'karuta' });
    if (pool.length >= 3) bonus.push({ type: 'spot', count: 4 });
    const b = shuffle(bonus.filter((x) => !used.has(x.type)))[0];
    if (b) games.push(b);
  }
  steps.push(...games.slice(0, max));
  return { fresh, pool, steps };
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
