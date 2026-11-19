// A play session: top bar (progress stones + streak lanterns), streak celebrations,
// and the adventure planner that strings games together.
import { el, mochi, petals, icon, wait, toast, overlay, keepAwake } from './ui.js';
import * as A from './audio.js';
import { introduced, newCharsForSession, updateTrophies, playableWords } from './learn.js';
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

    this.mini = mochi('idle', 'sm');
    this.stones = el('div', { class: 'stones' });
    this.lanternBar = el('div', { class: 'lantern-bar', 'aria-label': 'streak lanterns' });
    for (let i = 0; i < 5; i++) this.lanternBar.append(el('span', { class: 'lamp' }));
    const homeBtn = el('button', { class: 'icon-btn', 'aria-label': 'Leave', html: icon('home') });
    homeBtn.addEventListener('click', () => this.askExit());
    this.top = el('header', { class: 'game-top' }, homeBtn, this.stones, this.lanternBar, this.mini);
    this.stage = el('main', { class: 'stage' });
    this.node = el('div', { class: 'screen game-screen' }, this.top, this.stage);
    root.replaceChildren(this.node);
    this.renderStones();
    keepAwake(true);
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

  correct(h) {
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
      setTimeout(() => A.say(big ? 'streak10' : 'streak5'), 350);
      toast(el('span', { class: 'streak-toast' }, `${this.streak} in a row!`), 1600);
    } else {
      A.chime(0);
    }
  }
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
          el('button', { class: 'btn', onclick: () => { box.remove(); this.exited = true; this.onExit && this.onExit(); } }, 'Stop'),
        )));
    overlay().append(box);
  }
}

// Throw this to abort a game when the player leaves mid-way.
export class ExitError extends Error {}
export function guard(s) { if (s.exited) throw new ExitError(); }

// ---------------- Adventure planning ----------------
export function planAdventure(p) {
  const fresh = newCharsForSession(p);
  const pool = [...new Set([...introduced(p), ...fresh])];
  const steps = fresh.map((h) => ({ type: 'meet', h }));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const words = playableWords(pool).length;
  // Slot 1, hearing: new characters are always heard first in Listen & Pick.
  steps.push(fresh.length || pool.length < 3 ? { type: 'listen', count: 6 } : pick([{ type: 'listen', count: 6 }, { type: 'detective', count: 5 }]));
  steps.push({ type: 'trace', count: fresh.length ? 2 : 3 });
  // Slot 2, quick recognition with movement.
  steps.push(words >= 3 && Math.random() < 0.5 ? { type: 'river', count: 2 } : { type: 'goldfish', count: 6 });
  steps.push({ type: 'picwrite', count: 3 });
  // Slot 3, one or two "bonus" games, rotating so sessions feel different.
  const extras = [{ type: 'memory' }];
  if (pool.length >= 3) extras.push({ type: 'spot', count: 4 });
  if (pool.length >= 3) extras.push({ type: 'detective', count: 4 });
  if (pool.length >= 4) extras.push({ type: 'karuta', solo: true });
  if (words >= 3) extras.push({ type: 'sushi', count: 3 });
  const used = new Set(steps.map((x) => x.type));
  const choices = shuffle(extras.filter((x) => !used.has(x.type)));
  steps.push(...choices.slice(0, fresh.length ? 1 : 2));
  return { fresh, pool, steps };
}

export function finishSession(p, s, fresh) {
  const { earned, rows } = updateTrophies(p);
  const top = Object.entries(s.practiced).sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const stampChar = fresh[0] || top[0] || 'あ';
  p.stamps.push({ date: Date.now(), h: stampChar, chars: [...new Set([...fresh, ...top.slice(0, 4)])] });
  save();
  return { earned, rows, stampChar };
}

export { wait };
