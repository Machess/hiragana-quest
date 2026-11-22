import { el, mochi, wait, icon, holdButton, trophySVG, lanternSVG, petals, onTap, keepAwake, speakerIcon, setLook, kobanPill, kobanSVG, overlay, said, toast } from './ui.js';
import * as W from './wardrobe.js';
import * as A from './audio.js';
import * as S from './store.js';
import { KANA } from './data.js';
import * as L from './learn.js';
import {
  ROW_CHARS, introduced, mastery, rowUnlocked, rowComplete, kana, updateTrophies, playableWords,
  STEPS, MASTERED, stepOf, isIntroduced, charState, lookalikePairs, writingMode, introduce,
} from './learn.js';
import { Session, ExitError, planAdventure, planLevel, finishSession } from './session.js';
import { levelCheck } from './games/check.js';
import { meet, trace, listen, picwrite, dictation, writeOne } from './games/core.js';
import { goldfish, memory, karuta } from './games/extra.js';
import { detective, spot, sushi, river, readmatch } from './games/more.js';
import { animatedKanaSVG } from './trace.js';
import * as U from './update.js';

const app = document.getElementById('app');
const AVATARS = ['🦊', '🐼', '🐸', '🐱', '🐰', '🐻', '🐧', '🐯', '🐨', '🦉', '🐙', '🦄'];
const COLORS = ['#e4572e', '#f3a712', '#7fb069', '#2a9d8f', '#5b7bd5', '#a26fc4'];

let profile = null;

function screen(cls, ...children) {
  const n = el('div', { class: `screen ${cls}` }, ...children);
  app.replaceChildren(n);
  keepAwake(false);
  U.safeScreen(cls === 'home' || cls === 'profiles');
  return n;
}

// ---- 1280x800 stage, scaled evenly to fit the screen (1.5x on a 1920x1200 tablet) ----
const DESIGN_W = 1280, DESIGN_H = 800;
function fitStage() {
  const s = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
  document.documentElement.style.setProperty('--scale', s);
}
fitStage();
window.addEventListener('resize', fitStage);
window.addEventListener('orientationchange', () => setTimeout(fitStage, 200));
// No long-press menus or accidental text selection on the tablet.
document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input, .screen.parent')) e.preventDefault(); });
function backBtn(fn, label = 'Back') {
  const b = el('button', { class: 'icon-btn back', 'aria-label': label, html: icon('back') });
  b.addEventListener('click', fn);
  return b;
}

// First tap anywhere unlocks audio on mobile browsers.
document.addEventListener('pointerdown', () => A.unlockAudio(), { once: true, capture: true });

// ================= Profiles =================
function showProfiles() {
  profile = null;
  setLook(null);
  const list = el('div', { class: 'profile-list' });
  for (const p of S.profiles()) {
    const t = el('button', { class: 'profile-tile', style: { '--c': p.color } },
      el('span', { class: 'avatar' }, p.avatar, mochi('happy', 'xs', W.lookOf(p))), el('span', { class: 'pname' }, p.name),
      el('span', { class: 'pmeta' }, `${introduced(p).length} hiragana`));
    t.addEventListener('click', () => { A.unlockAudio(); profile = p; A.setEchoProfile(p); setLook(W.lookOf(p)); S.setLastProfile(p.id); showHome(true); });
    list.append(t);
  }
  const add = el('button', { class: 'profile-tile add' }, el('span', { class: 'avatar' }, '＋'), el('span', { class: 'pname' }, 'New player'));
  add.addEventListener('click', showNewProfile);
  list.append(add);
  screen('profiles',
    el('div', { class: 'title-row' }, mochi('idle', 'md'),
      el('div', {}, el('h1', {}, 'Hiragana Quest'), el('p', { class: 'sub' }, 'ひらがな クエスト'))),
    el('h2', {}, 'Who’s playing?'),
    list,
    el('div', { class: 'parent-corner' }, holdButton('Grown-ups (hold)', 2000, showParent, 'small')),
  );
}

function showNewProfile() {
  let avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  let color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const name = el('input', { class: 'name-input', maxlength: 16, placeholder: 'Your name', autocomplete: 'off' });
  const preview = el('div', { class: 'avatar big' }, avatar);
  const avs = el('div', { class: 'pick-grid' }, ...AVATARS.map((a) => {
    const b = el('button', { class: 'pick' + (a === avatar ? ' on' : '') }, a);
    b.onclick = () => { avatar = a; preview.textContent = a; [...avs.children].forEach((x) => x.classList.toggle('on', x === b)); };
    return b;
  }));
  const cols = el('div', { class: 'pick-row' }, ...COLORS.map((c) => {
    const b = el('button', { class: 'swatch' + (c === color ? ' on' : ''), style: { background: c }, 'aria-label': 'color' });
    b.onclick = () => { color = c; preview.style.background = c; [...cols.children].forEach((x) => x.classList.toggle('on', x === b)); };
    return b;
  }));
  preview.style.background = color;
  const create = el('button', { class: 'btn big' }, 'Start!');
  create.onclick = () => {
    if (!name.value.trim()) { name.focus(); name.classList.add('need'); return; }
    profile = S.createProfile(name.value, avatar, color); A.setEchoProfile(profile);
    setLook(W.lookOf(profile));
    S.setLastProfile(profile.id);
    A.unlockAudio();
    showHome(true);
  };
  screen('new-profile',
    el('div', { class: 'topline' }, backBtn(showProfiles), el('h2', {}, 'New player')),
    el('div', { class: 'np-body' },
      el('div', { class: 'np-left' }, preview, name, cols),
      el('div', { class: 'np-right' }, el('p', { class: 'label' }, 'Pick your animal'), avs)),
    el('div', { class: 'center' }, create),
  );
}

// ================= Home =================
function rowStrip(p) {
  return el('div', { class: 'row-strip' }, ...ROW_CHARS.map((r, i) => {
    const unlocked = rowUnlocked(p, i);
    const done = rowComplete(p, i);
    const prog = r.chars.reduce((a, h) => a + mastery(p, h), 0) / r.chars.length;
    return el('div', { class: `row-dot ${unlocked ? '' : 'locked'} ${done ? 'done' : ''}`, style: { '--prog': prog } },
      el('span', {}, r.label));
  }));
}

// What the next adventure is about: the current pair and its level, and the pairs of this row.
function adventurePreview(p) {
  const u = L.currentUnit(p);
  if (!u) return el('div', { class: 'adv-preview' }, el('span', {}, 'Every pair is gold! Adventures now mix everything up.'));
  const lv = L.unitLevel(p, u);
  const fresh = L.newCharsForSession(p);
  const units = L.rowUnits(u.row);
  const at = units.indexOf(u);
  return el('div', { class: 'adv-preview quest' },
    el('div', { class: 'quest-now' }, fresh.length ? 'New: ' : 'Now: ', el('b', { class: 'kana' }, u.chars.join(' ')),
      el('span', {}, ` · Level ${lv + 1} · ${L.LEVELS[lv + 1].icon} ${L.LEVELS[lv + 1].name}`)),
    el('div', { class: 'quest-units' }, ...units.map((x, i) => {
      const l = L.unitLevel(p, x);
      return el('div', { class: `unit ${i === at ? 'now' : i > at ? 'later' : ''}` },
        el('span', { class: 'unit-kana kana' }, x.chars.join('')),
        el('span', { class: 'unit-stones' }, ...[1, 2, 3].map((n) => el('i', { class: n <= l ? `on m${n}` : '' }))));
    })));
}

function showHome(greet = false) {
  const p = profile;
  const m = mochi('idle', 'lg');
  const n = introduced(p).length;
  const greeting = n === 0 ? `Hi ${p.name}! Ready to learn your first hiragana?` : `Welcome back, ${p.name}!`;
  const adv = el('button', { class: 'btn huge adventure' }, el('span', { html: icon('play') }), 'Adventure');
  adv.onclick = () => runAdventure();
  const tile = (label, emoji, fn, disabled) => {
    const b = el('button', { class: 'home-tile', disabled }, el('span', { class: 'emoji' }, emoji), label);
    b.onclick = fn;
    return b;
  };
  screen('home',
    el('div', { class: 'topline' }, backBtn(showProfiles, 'Change player'),
      el('div', { class: 'who', style: { '--c': p.color } }, el('span', { class: 'avatar' }, p.avatar), p.name)),
    el('div', { class: 'home-body' },
      el('div', { class: 'home-mochi' }, m, el('div', { class: 'bubble' }, ...(greet ? said('konnichiwa', greeting) : [greeting]))),
      el('div', { class: 'home-actions' }, adv, adventurePreview(p),
        el('div', { class: 'home-tiles' },
          tile('Dojo', '🥋', showDojo, n < 1 && !S.settings().openAll),
          tile('My Hiragana', 'あ', showChart),
          tile('Dressing Room', '👘', () => showDressingRoom()),
          tile('Trophies', '🏆', showTrophies),
          tile('Stamps', '🔴', showStamps)))),
    rowStrip(p),
  );
  app.querySelector('.topline').append(kobanPill(W.balance(p), 'home'));
  const wish = p.wish && W.item(p.wish);
  if (wish && !W.owns(p, wish.id)) {
    const have = Math.min(W.balance(p), wish.price);
    const goal = el('button', { class: 'wish-goal' },
      el('span', {}, 'Saving for '), el('b', { class: 'kana' }, wish.name),
      el('span', { class: 'wish-bar' }, el('i', { style: { transform: `scaleX(${have / wish.price})` } })),
      el('span', {}, `${have} / ${wish.price}`));
    goal.onclick = () => showDressingRoom(wish.cat, wish.id);
    app.querySelector('.home-mochi').append(goal);
  }
  app.querySelector('.home-tile:nth-child(2) .emoji').classList.add('kana-tile');
  if (greet) A.say('konnichiwa', { lead: 300 });
  m.hop();
}

// ================= Path display =================
function pathStones(p, h, { compact = false, lit = null } = {}) {
  const c = isIntroduced(p, h) ? charState(p, h) : { step: 0, prog: 0 };
  return el('div', { class: `path ${compact ? 'compact' : ''}` }, ...STEPS.map((st, i) => {
    const state = c.step > i ? 'done' : c.step === i ? 'here' : 'todo';
    const fresh = lit && lit.includes(i);
    const dots = state === 'here' && !compact && st.need > 1
      ? el('span', { class: 'path-dots' }, ...Array.from({ length: st.need }, (_, k) => el('i', { class: k < c.prog ? 'on' : '' })))
      : null;
    return el('div', { class: `path-stone ${state} ${fresh ? 'fresh' : ''}`, style: { '--d': `${i * 0.12}s` } },
      el('span', { class: 'path-icon emoji' }, st.icon),
      compact ? null : el('span', { class: 'path-name' }, st.name), dots);
  }));
}

// ================= Adventure =================
async function runAdventure() {
  const p = profile;
  const plan = planAdventure(p);
  A.preloadChars(plan.pool);
  const s = new Session({ profile: p, root: app, steps: plan.steps.length, onExit: () => showHome() });
  try {
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const r = await runStep(s, step, plan.pool);
      if (s.exited) return;
      s.nextStep();
      // Nearly everything right first try: offer the next level straight away (once per adventure).
      const answered = s.correctCount + s.missCount;
      if (step.type === 'check' && r && r.passed && step.level < 3 && !s.bonusOffered && answered && s.correctCount / answered >= 0.9) {
        s.bonusOffered = true;
        if (await offerNextLevel(s, step.level + 1)) {
          const u = L.UNITS.find((x) => x.id === step.unitId);
          const more = planLevel(p, u, step.level + 1).steps;
          plan.steps.push(...more);
          s.addSteps(more.length);
        }
      }
    }
  } catch (e) {
    if (e instanceof ExitError) return;
    throw e;
  }
  const result = finishSession(p, s, plan.fresh);
  await stepsSummary(result.climbed);
  await trophyCeremony(result);
  await stampEnd(s);
}

// "You're doing great — try Level 2 now?" Yes adds the next level's games to this adventure.
function offerNextLevel(s, level) {
  return new Promise((res) => {
    const later = el('button', { class: 'btn soft big' }, 'Next time');
    const yes = el('button', { class: 'btn big' }, 'Yes!');
    later.onclick = () => res(false);
    yes.onclick = () => res(true);
    s.view('check-card offer', el('h2', {}, `So good! Try Level ${level} now?`),
      el('div', { class: 'check-side' }, mochi('happy', 'lg'), el('div', { class: 'bubble' }, `${L.LEVELS[level].icon} ${L.LEVELS[level].name}`)),
      el('div', { class: 'row-btns center' }, later, yes));
  });
}

const COUNTS = { trace: 3, listen: 6, goldfish: 6, detective: 5, spot: 4, picwrite: 3, dictation: 3, sushi: 3, readmatch: 4, river: 2 };
async function runStep(s, step, pool) {
  const o = { pool: step.pool || pool, boost: step.boost || [], only: step.only || null, count: step.count || COUNTS[step.type] };
  switch (step.type) {
    case 'check': return levelCheck(s, step);
    case 'meet': return meet(s, step.h);
    case 'trace': return trace(s, o);
    case 'listen': return listen(s, o);
    case 'goldfish': return goldfish(s, o);
    case 'picwrite': return picwrite(s, o);
    case 'dictation': return dictation(s, o);
    case 'memory': return memory(s, o);
    case 'karuta': return karuta(s, { ...o, players: step.players || [{ profile: s.p, name: s.p.name, avatar: s.p.avatar }] });
    case 'detective': return detective(s, o);
    case 'spot': return spot(s, o);
    case 'sushi': return sushi(s, o);
    case 'river': return river(s, o);
    case 'readmatch': return readmatch(s, o);
  }
}

// "Today's steps": every character that moved along its path this session.
async function stepsSummary(climbed) {
  if (!climbed || !climbed.length) return;
  const p = profile;
  const byChar = new Map();
  for (const c of climbed) {
    const e = byChar.get(c.h) || { h: c.h, steps: [] };
    e.steps.push(c.from);
    byChar.set(c.h, e);
  }
  const rows = [...byChar.values()].slice(0, 6).map((e) =>
    el('div', { class: 'sum-row' }, el('span', { class: 'sum-kana kana' }, e.h), pathStones(p, e.h, { compact: true, lit: e.steps })));
  const next = el('button', { class: 'btn big' }, 'Next');
  screen('summary', el('h2', {}, 'Steps you climbed today'), el('div', { class: 'sum-list' }, ...rows),
    el('div', { class: 'center' }, mochi('happy', 'md'), next));
  A.chime(1);
  await new Promise((r) => next.addEventListener('click', r, { once: true }));
}

async function trophyCeremony({ earned, rows }) {
  if (earned.length || rows.length) {
    const shelf = el('div', { class: 'ceremony-shelf' });
    const v = screen('ceremony',
      el('h2', { class: 'said' }, ...said('trophy', 'New trophies!')),
      shelf,
      el('div', { class: 'center' }, mochi('happy', 'md')));
    A.say('trophy', { lead: 300 });
    for (const r of rows) {
      shelf.append(el('div', { class: 'cer-item row', html: lanternSVG(r.label, true) }));
      A.chime(2); petals(16);
      await wait(1100);
    }
    for (const t of earned.slice(0, 12)) {
      shelf.append(el('div', { class: 'cer-item', html: trophySVG(t.h, t.level) },
        el('div', { class: 'cer-label' }, ['', 'Bronze', 'Silver', 'Gold'][t.level])));
      A.chime(t.level >= 2 ? 1 : 0);
      if (t.level === 3) petals(10);
      await wait(800);
    }
    const next = el('button', { class: 'btn big' }, 'Next');
    v.append(el('div', { class: 'center' }, next));
    await new Promise((r) => next.addEventListener('click', r, { once: true }));
  }
}

async function stampEnd(s) {
  const p = profile;
  const card = stampCard(p, true);
  const m = mochi('sleepy', 'md');
  const done = el('button', { class: 'btn big' }, 'Done');
  screen('stamp-end',
    el('div', { class: 'stamp-end-top' }, m, el('div', { class: 'bubble' }, el('span', { class: 'said-ja kana' }, A.line('ganbatta').ja), `Great work today! You got ${s.correctCount} right`,
      s.coinsEarned ? el('span', { class: 'earned' }, ' and earned ', kobanPill(s.coinsEarned)) : '', '.')),
    card,
    el('div', { class: 'center' }, done));
  await wait(700);
  A.stampThunk();
  card.querySelector('.stamp.new')?.classList.add('land');
  A.say('ganbatta', { lead: 700 });
  done.onclick = () => showHome();
}

function stampCard(p, animateLast = false) {
  const per = 20;
  const total = p.stamps.length;
  const cardIdx = Math.max(0, Math.floor((total - 1) / per));
  const slice = p.stamps.slice(cardIdx * per, cardIdx * per + per);
  const slots = Array.from({ length: per }, (_, i) => {
    const st = slice[i];
    if (!st) return el('div', { class: 'slot' }, el('span', { class: 'slot-n' }, i + 1));
    const isNew = animateLast && i === slice.length - 1;
    return el('div', { class: 'slot' },
      el('div', { class: 'stamp' + (isNew ? ' new' : ''), style: { '--r': ((st.date % 17) - 8) + 'deg' } }, st.h));
  });
  return el('div', { class: 'stamp-card' },
    el('div', { class: 'stamp-card-title' }, `Stamp card ${cardIdx + 1}`, el('span', {}, `${total} ${total === 1 ? 'adventure' : 'adventures'}`)),
    el('div', { class: 'stamp-grid' }, ...slots));
}

// ================= Hiragana chart (五十音) =================
// Columns are the rows あ か さ …, top to bottom the vowels a i u e o.
const VOWEL = { a: 0, i: 1, u: 2, e: 3, o: 4 };
function chartPos(h) {
  const r = kana(h).r;
  if (h === 'ん') return 2;
  if (h === 'を') return 4;
  return VOWEL[r[r.length - 1]];
}
const canPractise = (p, h) => isIntroduced(p, h) || S.settings().openAll;

function chartGrid(p, { cell = 'lg', selected = null, onCell, onColumn } = {}) {
  const grid = el('div', { class: `chart chart-${cell}` });
  ROW_CHARS.forEach((r, ci) => {
    const col = el('div', { class: 'chart-col' });
    const head = el('button', { class: 'chart-head kana' + (rowUnlocked(p, ci) ? '' : ' locked') }, r.label);
    if (onColumn) head.onclick = () => onColumn(r, ci);
    col.append(head);
    const slots = Array(5).fill(null);
    r.chars.forEach((h) => { slots[chartPos(h)] = h; });
    slots.forEach((h) => {
      if (!h) { col.append(el('div', { class: 'chart-cell empty' })); return; }
      const met = isIntroduced(p, h);
      const st = stepOf(p, h);
      const cls = ['chart-cell', met ? 'met' : 'unmet', st >= MASTERED ? 'mastered' : '', selected && selected.has(h) ? 'sel' : '',
        !canPractise(p, h) ? 'locked' : ''].join(' ');
      const b = el('button', { class: cls, 'data-h': h, style: { '--prog': mastery(p, h) } },
        el('span', { class: 'kana' }, h), met && st >= MASTERED ? el('span', { class: 'chart-star' }, '⭐') : null);
      onTap(b, () => onCell && onCell(h, b));
      col.append(b);
    });
    grid.append(col);
  });
  return grid;
}

function showChart() {
  const p = profile;
  const met = introduced(p).length;
  const mastered = introduced(p).filter((h) => stepOf(p, h) >= MASTERED).length;
  screen('chart',
    el('div', { class: 'topline' }, backBtn(() => showHome()), el('h2', {}, 'My Hiragana'),
      el('div', { class: 'chart-count' }, `${met} met · ${mastered} ⭐`)),
    chartGrid(p, { onCell: (h) => showCharCard(h, showChart) }),
    el('p', { class: 'hint-text center' }, 'Tap a hiragana to see its path and practise it.'));
}

// ================= Character card =================
function showCharCard(h, back) {
  const p = profile;
  const k = kana(h);
  const met = isIntroduced(p, h);
  const big = el('div', { class: 'cc-big', html: animatedKanaSVG(h, { perStroke: 0.9 }) });
  onTap(big, () => { big.innerHTML = animatedKanaSVG(h, { perStroke: 0.9 }); A.tapKana(h); });
  const sp = el('button', { class: 'speaker lg', html: speakerIcon(), 'aria-label': 'Play sound' });
  onTap(sp, () => A.tapKana(h));
  const word = el('button', { class: 'cc-word' }, el('span', { class: 'emoji' }, k.emoji),
    el('span', { class: 'jp' }, ...[...k.word].map((c, i) => el('span', { class: i === k.idx ? 'hl' : '' }, c))));
  onTap(word, () => A.tapWord(h));
  const lvl = p.trophies[h] || 0;
  const actions = el('div', { class: 'cc-actions' });
  if (canPractise(p, h)) {
    const go = el('button', { class: 'btn big' }, `Practise ${h}`);
    go.onclick = () => runDojo('mixed', [h], () => showCharCard(h, back));
    const tr = el('button', { class: 'btn soft' }, '✍️ Writing practice');
    tr.onclick = () => runDojo('trace', [h], () => showCharCard(h, back));
    actions.append(go, tr);
  } else {
    actions.append(el('p', { class: 'hint-text' }, 'You’ll meet this one on an adventure soon!'));
  }
  const st = met ? stepOf(p, h) : -1;
  const now = st >= MASTERED ? 'Mastered! ⭐' : st >= 0 ? `Now: ${STEPS[st].icon} ${STEPS[st].name}` : 'Not met yet';
  screen('charcard',
    el('div', { class: 'topline' }, backBtn(back), el('h2', {}, el('span', { class: 'kana' }, h), S.settings().romaji ? ` (${k.r})` : '')),
    el('div', { class: 'cc-body' },
      el('div', { class: 'cc-left' }, big, sp),
      el('div', { class: 'cc-right' },
        el('div', { class: 'cc-top' }, word, el('div', { class: 'cc-trophy', html: trophySVG(h, lvl, undefined, met) })),
        el('div', { class: 'cc-now' }, now),
        pathStones(p, h),
        actions)));
  A.sayKana(h, { lead: 300 });
}

// ================= Dojo: practise your own pick =================
const DOJO_GAMES = [
  { id: 'mixed', name: 'Mixed', emoji: '🎲' },
  { id: 'trace', name: 'Write it', emoji: '✍️' },
  { id: 'listen', name: 'Listen & Pick', emoji: '👂', pool: 2 },
  { id: 'goldfish', name: 'Goldfish', emoji: '🐟', pool: 2 },
  { id: 'detective', name: 'Sound Detective', emoji: '🔍', pool: 2 },
  { id: 'spot', name: 'Spot the Different', emoji: '👀', pool: 2 },
  { id: 'picwrite', name: 'Picture Write', emoji: '🖼️' },
  { id: 'dictation', name: 'Dictation', emoji: '📝' },
  { id: 'readmatch', name: 'Read & Match', emoji: '📖', words: 1 },
  { id: 'sushi', name: 'Sushi Train', emoji: '🍣', words: 1 },
  { id: 'river', name: 'Stepping Stones', emoji: '🪨', words: 1 },
  { id: 'memory', name: 'Memory', emoji: '🃏', pool: 2 },
  { id: 'karuta', name: 'Karuta', emoji: '🎴', pool: 4 },
];
function dojoPool(p, sel) { return [...new Set([...introduced(p), ...sel])]; }
function wordsFor(pool, sel) {
  return playableWords(pool, { max: 4 }).filter((w) => [...w.w].some((c) => sel.includes(c)));
}
function gameOK(g, p, sel) {
  if (!sel.length) return false;
  const pool = dojoPool(p, sel);
  if (g.pool && pool.length < g.pool) return false;
  if (g.words && wordsFor(pool, sel).length < g.words) return false;
  return true;
}

function showDojo() {
  const p = profile;
  const known = introduced(p);
  let sel = new Set((p.dojoSel || []).filter((h) => canPractise(p, h)));
  if (!sel.size && known.length) sel = new Set(known.slice(-Math.min(3, known.length)));
  const info = el('div', { class: 'dojo-sel' });
  const tiles = el('div', { class: 'dojo-games' });
  let grid;
  const refresh = () => {
    p.dojoSel = [...sel];
    S.save();
    grid.querySelectorAll('.chart-cell[data-h]').forEach((c) => c.classList.toggle('sel', sel.has(c.dataset.h)));
    info.replaceChildren(sel.size ? el('span', {}, 'Practising: ', el('b', { class: 'kana' }, [...sel].join(' '))) : el('span', {}, 'Tap the hiragana you want to practise'));
    const s = [...sel];
    tiles.replaceChildren(...DOJO_GAMES.map((g) => {
      const ok = gameOK(g, p, s);
      const b = el('button', { class: 'dojo-tile' + (ok ? '' : ' off'), disabled: !ok }, el('span', { class: 'emoji' }, g.emoji), el('span', {}, g.name));
      b.onclick = () => (g.id === 'karuta' ? showKarutaSetup(s) : runDojo(g.id, s, showDojo));
      return b;
    }));
  };
  grid = chartGrid(p, {
    cell: 'sm',
    selected: sel,
    onCell: (h) => {
      if (!canPractise(p, h)) { A.tok(); return; }
      if (sel.has(h)) sel.delete(h); else sel.add(h);
      A.tapKana(h);
      refresh();
    },
    onColumn: (r) => {
      const ok = r.chars.filter((h) => canPractise(p, h));
      if (!ok.length) return;
      const all = ok.every((h) => sel.has(h));
      ok.forEach((h) => (all ? sel.delete(h) : sel.add(h)));
      refresh();
    },
  });
  const chip = (label, fn) => { const b = el('button', { class: 'chip' }, label); b.onclick = () => { fn(); refresh(); }; return b; };
  const chips = el('div', { class: 'dojo-chips' },
    chip('😵 My tricky ones', () => { sel = new Set([...known].sort((a, b) => mastery(p, a) - mastery(p, b)).slice(0, 5)); }),
    chip('🌈 Everything I know', () => { sel = new Set(known); }),
    chip('🧹 Clear', () => { sel = new Set(); }),
    el('p', { class: 'small' }, 'Tip: tap a column letter (あ, か…) to pick a whole row.'));
  screen('dojo',
    el('div', { class: 'topline' }, backBtn(() => showHome()), el('h2', {}, 'Dojo 道場'), info),
    el('div', { class: 'dojo-top' }, grid, chips),
    tiles);
  refresh();
}

// Games that ask about one character per round: in the Dojo they grow to cover every chosen one.
const PER_CHAR = new Set(['trace', 'listen', 'goldfish', 'detective', 'spot', 'picwrite', 'dictation']);
const DOJO_MAX = 12;
// Which chosen characters the last Dojo game showed, so "Again!" starts with the others.
let dojoLast = { key: '', shown: new Set() };

// Run one Dojo game (or a short mix) on the chosen characters.
async function runDojo(type, chosen, back) {
  const p = profile;
  const key = [...chosen].sort().join('');
  const seen = dojoLast.key === key ? dojoLast.shown : new Set();
  const shuffled = (a) => a.map((x) => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  // Not-yet-shown first, each group shuffled: across "Again!" rounds every chosen one comes up.
  const sel = [...shuffled(chosen.filter((h) => !seen.has(h))), ...shuffled(chosen.filter((h) => seen.has(h)))];
  const pool = dojoPool(p, sel);
  A.preloadChars(pool);
  const steps = [];
  // With "Open all hiragana", a character that hasn't been met yet is met first.
  sel.filter((h) => !isIntroduced(p, h)).slice(0, 3).forEach((h) => steps.push({ type: 'meet', h }));
  if (type === 'mixed') steps.push(...mixFor(p, pool, sel));
  else steps.push({ type, only: sel, count: PER_CHAR.has(type) ? Math.min(DOJO_MAX, Math.max(COUNTS[type] || 6, sel.length)) : (COUNTS[type] || 6) });
  const s = new Session({ profile: p, root: app, steps: steps.length, onExit: back });
  try {
    for (const st of steps) {
      if (st.type !== 'meet' && st.only) st.only = st.only.filter((h) => isIntroduced(p, h) || sel.includes(h));
      await runStep(s, st, pool);
      if (s.exited) return;
      s.nextStep();
    }
  } catch (e) {
    if (e instanceof ExitError) return;
    throw e;
  }
  s.end();
  const shown = new Set([...seen, ...Object.keys(s.practiced).filter((h) => chosen.includes(h))]);
  dojoLast = { key, shown: shown.size >= chosen.length ? new Set() : shown };
  await stepsSummary(s.climbed);
  await trophyCeremony(updateTrophies(p));
  dojoEnd(type, chosen, back);
}

// A short mix that fits where the chosen characters are on their paths.
function mixFor(p, pool, sel) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const lo = Math.min(...sel.map((h) => (isIntroduced(p, h) ? stepOf(p, h) : 1)));
  const out = [];
  // Each game in the mix starts further along the chosen list, so together they cover all of it.
  let at = 0;
  const slice = (n) => { const r = [...sel.slice(at), ...sel.slice(0, at)]; at = (at + n) % Math.max(1, sel.length); return r; };
  const many = Math.min(8, Math.max(4, Math.ceil(sel.length / 2)));
  if (lo <= L.S.copy) out.push({ type: 'trace', only: slice(3), count: Math.min(3, sel.length + 1) });
  if (pool.length >= 2) out.push({ type: pick(['listen', 'goldfish']), only: slice(many), count: many });
  if (pool.length >= 2) out.push({ type: pick(['detective', 'spot']), only: slice(many), count: many });
  if (lo > L.S.copy) out.push({ type: pick(['picwrite', 'dictation']), only: slice(2), count: 2 });
  if (wordsFor(pool, sel).length) out.push({ type: pick(['readmatch', 'sushi']), only: sel, count: 3 });
  if (!out.length) out.push({ type: 'trace', only: sel, count: 2 });
  return out.slice(0, 4);
}

function dojoEnd(type, sel, back) {
  const again = el('button', { class: 'btn big' }, 'Again!');
  again.onclick = () => runDojo(type, sel, back);
  const other = el('button', { class: 'btn soft' }, 'Back');
  other.onclick = back;
  screen('dojo-end', mochi('happy', 'lg'), el('div', { class: 'bubble' }, ...said('yokudekimashita', 'Nice practice!')),
    el('div', { class: 'row-btns center' }, other, again));
  A.say('yokudekimashita', { lead: 300 });
}

function showKarutaSetup(sel) {
  const p = profile;
  const others = S.profiles().filter((x) => x.id !== p.id);
  const start = (players) => runDojoKaruta(players, sel);
  const me = { profile: p, name: p.name, avatar: p.avatar };
  const opts = el('div', { class: 'karuta-opts' },
    (() => { const b = el('button', { class: 'game-tile' }, el('span', { class: 'emoji' }, '🐰'), el('span', { class: 'gname' }, 'Play against Mochi')); b.onclick = () => start([me]); return b; })(),
    ...others.map((o) => { const b = el('button', { class: 'game-tile' }, el('span', { class: 'emoji' }, o.avatar), el('span', { class: 'gname' }, `Play with ${o.name}`)); b.onclick = () => start([me, { profile: o, name: o.name, avatar: o.avatar }]); return b; }),
    (() => { const b = el('button', { class: 'game-tile' }, el('span', { class: 'emoji' }, '🧑'), el('span', { class: 'gname' }, 'Play with a grown-up')); b.onclick = () => start([me, { profile: null, name: 'Grown-up', avatar: '🧑' }]); return b; })(),
  );
  screen('karuta-setup', el('div', { class: 'topline' }, backBtn(showDojo), el('h2', {}, 'Karuta かるた')),
    el('p', { class: 'hint-text' }, 'Listen to the reader, then grab the right card first! Two players: sit opposite each other with the tablet flat between you.'),
    opts);
}
async function runDojoKaruta(players, sel) {
  const p = profile;
  const pool = dojoPool(p, sel);
  A.preloadChars(pool);
  const s = new Session({ profile: p, root: app, steps: 1, onExit: showDojo });
  try {
    await karuta(s, { pool, boost: [], only: sel, players });
  } catch (e) {
    if (e instanceof ExitError) return;
    throw e;
  }
  s.end();
  for (const pl of players) if (pl.profile && pl.profile !== p) updateTrophies(pl.profile);
  await trophyCeremony(updateTrophies(p));
  showDojo();
}

// ================= Mochi's Dressing Room =================
// Earn koban by learning, spend them on anything. Trying on is always free.
const DEFAULTS = {
  color: { name: 'しろ', en: 'classic' }, hat: { name: 'なし', en: 'no hat' }, item: { name: 'なし', en: 'nothing' },
  reaction: { name: 'ぴょこ', en: 'hop' }, celebration: { name: 'さくら', en: 'sakura petals' },
};
// Hiragana name with characters the child hasn't met yet shown dimmed.
function kanaName(p, name) {
  return el('span', { class: `kana iname ${name.length > 6 ? 'long' : ''}` }, ...[...name].map((c) =>
    (c === ' ' ? ' ' : el('span', { class: isIntroduced(p, c) ? '' : 'dim' }, c))));
}

function showDressingRoom(startCat = 'color', startId) {
  const p = profile;
  let cat = startCat;
  let selected = startId || W.lookOf(p)[cat] || null;
  const stageMochi = mochi('happy', 'xl', W.lookOf(p));
  const nameRow = el('div', { class: 'dr-name' });
  const actions = el('div', { class: 'dr-actions' });
  const tabs = el('div', { class: 'dr-tabs' });
  const grid = el('div', { class: 'dr-grid' });
  const purse = kobanPill(W.balance(p), 'big');

  const preview = () => ({ ...W.lookOf(p), [cat]: selected });
  const sayName = (id) => (id ? A.play(`audio/wardrobe/${id}.mp3`, { interrupt: true }) : null);

  function renderStage() {
    stageMochi.setLook(preview());
    const it = selected ? W.item(selected) : null;
    const d = it || DEFAULTS[cat];
    const sp = el('button', { class: 'speaker', 'aria-label': 'Say the name', html: speakerIcon() });
    onTap(sp, () => sayName(selected));
    nameRow.replaceChildren(kanaName(p, d.name), it ? sp : '', el('span', { class: 'iname-en' }, d.en));
    const worn = W.lookOf(p)[cat] === selected;
    const ownedIt = !it || W.owns(p, it.id);
    actions.replaceChildren();
    if (ownedIt) {
      if (worn) {
        actions.append(el('span', { class: 'dr-wearing' }, '✓ Mochi is wearing this'));
      } else {
        const wearBtn = el('button', { class: 'btn big' }, it ? 'Wear it' : 'Choose this');
        wearBtn.onclick = () => {
          if (it) W.wear(p, it.id); else W.takeOff(p, cat);
          setLook(W.lookOf(p));
          stageMochi.react(); A.say('niau', { interrupt: true }); toast(el('span', {}, ...said('niau')), 1800);
          render();
        };
        actions.append(wearBtn);
      }
    } else if (W.balance(p) >= it.price) {
      const buyBtn = el('button', { class: 'btn big buy' }, 'Buy for ', kobanPill(it.price));
      buyBtn.onclick = () => confirmBuy(it);
      actions.append(buyBtn);
    } else {
      const need = it.price - W.balance(p);
      actions.append(el('div', { class: 'dr-need' },
        el('span', { class: 'wish-bar wide' }, el('i', { style: { transform: `scaleX(${W.balance(p) / it.price})` } })),
        el('span', {}, `${W.balance(p)} / ${it.price} koban · ${need} more to go`)));
      const wishBtn = el('button', { class: 'btn soft' }, p.wish === it.id ? '⭐ Saving for this' : '⭐ Save for this');
      wishBtn.onclick = () => { p.wish = p.wish === it.id ? null : it.id; S.save(); renderStage(); };
      actions.append(wishBtn);
    }
  }

  function confirmBuy(it) {
    const box = el('div', { class: 'modal-back' }, el('div', { class: 'modal' },
      mochi('happy', 'md', { ...W.lookOf(p), [it.cat]: it.id }),
      el('p', { class: 'modal-text' }, 'Buy ', kanaName(p, it.name), ' for ', kobanPill(it.price), '?'),
      el('p', { class: 'small' }, `You'll have ${W.balance(p) - it.price} koban left.`),
      el('div', { class: 'row-btns' },
        el('button', { class: 'btn soft', onclick: () => box.remove() }, 'Not now'),
        el('button', { class: 'btn', onclick: () => {
          box.remove();
          if (!W.buy(p, it.id)) return;
          setLook(W.lookOf(p));
          A.clink(); A.chime(1); petals(16, it.cat === 'celebration' ? it.id : null);
          stageMochi.react(); A.say('kawaii', { interrupt: true }); toast(el('span', {}, ...said('kawaii')), 1800);
          render();
        } }, 'Buy!'))));
    overlay().append(box);
  }

  function card(id) {
    const it = id ? W.item(id) : null;
    const d = it || DEFAULTS[cat];
    const look = { ...W.lookOf(p), [cat]: id };
    let pic;
    if (cat === 'celebration') {
      pic = el('div', { class: 'dr-cele' }, ...Array.from({ length: 5 }, (_, i) =>
        el('span', { class: `petal ${id || 'e-sakura'} still`, style: { left: `${12 + i * 17}%`, top: `${[20, 55, 10, 45, 25][i]}%`, '--c': ['#f6b7c4', '#9cc8e8', '#ffe08a', '#b9dca0', '#f6b7c4'][i] } })));
    } else {
      pic = mochi(cat === 'reaction' && (id === 'r-wink' || id === 'r-sparkle') ? (id === 'r-wink' ? 'wink' : 'stars') : 'idle', 'card', look);
    }
    const worn = W.lookOf(p)[cat] === id;
    const status = !it ? (worn ? el('span', { class: 'tag on' }, '✓ Wearing') : el('span', { class: 'tag' }, 'Free'))
      : W.owns(p, id) ? el('span', { class: `tag ${worn ? 'on' : 'own'}` }, worn ? '✓ Wearing' : 'Yours')
        : el('span', { class: 'tag price' }, kobanPill(it.price), p.wish === id ? ' ⭐' : '');
    const b = el('button', { class: `dr-card ${selected === id ? 'sel' : ''} ${it && !W.owns(p, id) ? 'shop' : ''}`, 'data-id': id || '' },
      pic, kanaName(p, d.name), status);
    onTap(b, () => {
      selected = id;
      grid.querySelectorAll('.dr-card').forEach((x) => x.classList.toggle('sel', x === b));
      renderStage();
      if (cat === 'reaction') stageMochi.react(id || 'r-hop');
      else if (cat === 'celebration') petals(12, id || 'e-sakura');
      sayName(id);
    });
    return b;
  }

  function render() {
    purse.querySelector('b').textContent = W.balance(p);
    tabs.replaceChildren(...W.CATS.map((c) => {
      const t = el('button', { class: `dr-tab ${c.id === cat ? 'on' : ''}` }, el('span', { class: 'emoji' }, c.icon), c.name);
      t.onclick = () => { cat = c.id; selected = W.lookOf(p)[cat] || null; render(); };
      return t;
    }));
    grid.replaceChildren(card(null), ...W.ITEMS.filter((x) => x.cat === cat).map((x) => card(x.id)));
    renderStage();
  }

  screen('dressing',
    el('div', { class: 'topline' }, backBtn(() => showHome()), el('h2', {}, 'Mochi’s Dressing Room'), purse),
    el('div', { class: 'dr-body' },
      el('div', { class: 'dr-stage' }, el('div', { class: 'dr-rug' }), stageMochi, nameRow, actions),
      el('div', { class: 'dr-shop' }, tabs, grid,
        el('p', { class: 'small dr-how' }, 'Earn koban: 1 for every 5 right answers · 3 for each adventure · 1 for each path step · 5 for each ⭐ · 10 for a gold row'))));
  render();
}

// ================= Trophy room =================
function showTrophies() {
  const p = profile;
  const shelves = ROW_CHARS.map((r, i) => {
    const unlocked = rowUnlocked(p, i);
    return el('div', { class: 'shelf' + (unlocked ? '' : ' locked') },
      el('div', { class: 'shelf-lantern', html: lanternSVG(r.label, !!p.rowTrophies[r.id]) }),
      el('div', { class: 'shelf-items' }, ...r.chars.map((h) => {
        const lvl = p.trophies[h] || 0;
        const met = isIntroduced(p, h);
        const t = el('button', { class: 'trophy', 'aria-label': h, html: trophySVG(h, lvl, undefined, met) });
        if (S.settings().romaji && met) t.append(el('span', { class: 'romaji' }, kana(h).r));
        if (met) onTap(t, () => showCharCard(h, showTrophies));
        return t;
      })));
  });
  const counts = [1, 2, 3].map((l) => Object.values(p.trophies).filter((x) => x === l).length);
  screen('trophies',
    el('div', { class: 'topline' }, backBtn(() => showHome()), el('h2', {}, `${p.name}’s Trophy Room`),
      el('div', { class: 'tcount' },
        el('span', { class: 'b' }, `● ${counts[0]}`), el('span', { class: 's' }, `● ${counts[1]}`), el('span', { class: 'g' }, `● ${counts[2]}`))),
    el('p', { class: 'hint-text' }, 'Bronze: Level 1 (meet & write) · Silver: Level 2 (hear & read) · Gold: Level 3 (use & mix)'),
    el('div', { class: 'shelves' }, ...shelves));
}

function showStamps() {
  const p = profile;
  screen('stamps', el('div', { class: 'topline' }, backBtn(() => showHome()), el('h2', {}, 'Stamp card')),
    stampCard(p),
    el('p', { class: 'hint-text' }, 'Finish an Adventure to get a stamp!'));
}

// ================= Parent area =================
// Mochi speaks Japanese, then the same in English while the child is still learning the phrase.
function echoSetting(st) {
  const opts = [['fade', 'Fade out as they learn (English stops once a phrase is familiar)'], ['always', 'Always'], ['off', 'Off (Japanese only)']];
  const cur = st.echo || 'fade';
  return el('div', { class: 'echo-set' }, el('div', { class: 'echo-title' }, 'Mochi says it in English too'),
    ...opts.map(([v, label]) => {
      const r = el('input', { type: 'radio', name: 'echo', value: v });
      r.checked = cur === v;
      r.onchange = () => { S.setSetting('echo', v); if (v !== 'off') A.say('sugoi', { interrupt: true }); };
      return el('label', { class: 'toggle' }, r, label);
    }));
}

function showParent() {
  const st = S.settings();
  const vol = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st.volume });
  vol.oninput = () => S.setSetting('volume', +vol.value);
  vol.onchange = () => A.tapKana('あ');
  const toggle = (key, label) => {
    const c = el('input', { type: 'checkbox' });
    c.checked = !!st[key];
    c.onchange = () => S.setSetting(key, c.checked);
    return el('label', { class: 'toggle' }, c, label);
  };
  const pc = (x) => Math.round((x || 0) * 100) + '%';
  const plist = el('div', { class: 'parent-profiles' }, ...S.profiles().map((p) => {
    const table = el('table', { class: 'progress-table' },
      el('tr', {}, el('th', {}, ''), el('th', {}, 'Sound'), el('th', {}, 'Path step'), el('th', {}, 'Hear'), el('th', {}, 'Read'), el('th', {}, 'Write')),
      ...KANA.filter((k) => isIntroduced(p, k.h)).map((k) => {
        const c = charState(p, k.h);
        const stepTxt = c.step >= MASTERED ? '⭐ Mastered' : `${STEPS[c.step].icon} ${STEPS[c.step].name} (${c.prog}/${STEPS[c.step].need})`;
        return el('tr', {}, el('td', { class: 'kana' }, k.h), el('td', {}, k.r), el('td', {}, stepTxt),
          el('td', {}, pc(c.hear)), el('td', {}, pc(c.read)), el('td', {}, pc(c.write)));
      }));
    const locked = ROW_CHARS.findIndex((r, i) => !rowUnlocked(p, i));
    return el('details', { class: 'pp' },
      el('summary', {}, el('span', { class: 'avatar' }, p.avatar), `${p.name} — ${introduced(p).length} hiragana, ${p.stamps.length} adventures, best streak ${p.bestStreak || 0}, ${W.balance(p)} koban, ${(p.owned || []).length} of ${W.ITEMS.length} wardrobe items`),
      (() => { const u = L.currentUnit(p); return u ? el('p', { class: 'small' }, `Now learning ${u.chars.join(' ')}: Level ${L.unitLevel(p, u) + 1} of 3 (${L.LEVELS[L.unitLevel(p, u) + 1].name}).`) : null; })(),
      locked > 0 ? el('p', { class: 'small' }, `Next row (${ROW_CHARS[locked].label}) opens when every pair in the ${ROW_CHARS[locked - 1].label} row has reached Level 3.`) : null,
      table,
      el('div', { class: 'row-btns' },
        holdButton('Hold to reset progress', 2500, () => { S.resetProfile(p.id); showParent(); }, 'warn'),
        holdButton('Hold to delete player', 2500, () => { S.deleteProfile(p.id); showParent(); }, 'warn')));
  }));
  screen('parent',
    el('div', { class: 'topline' }, backBtn(showProfiles), el('h2', {}, 'Grown-ups')),
    el('section', { class: 'card-sec' }, el('h3', {}, 'Settings'),
      el('label', { class: 'slider' }, 'Volume', vol),
      echoSetting(st),
      toggle('romaji', 'Show romaji hints to kids'),
      toggle('openAll', 'Open all hiragana in the Dojo (for kids who already know some)'),
      toggle('reducedMotion', 'Calmer animations')),
    el('section', { class: 'card-sec' }, el('h3', {}, 'Players'), plist),
    versionSection(),
    el('section', { class: 'card-sec small' }, el('h3', {}, 'How it works'),
      el('p', {}, 'Hiragana are learned two at a time (あい, うえ, お…), one row at a time. Each pair climbs three levels: 1 · Meet & Write (tracing, then copying with a model, and hearing it among two), 2 · Hear & Read (recognising it by sound and by sight among the pairs learned so far in the row), 3 · Use & Mix (writing from memory, words, and earlier rows mixed in, so the か row keeps the あ row fresh). A level ends with a short check; one slip is fine, otherwise the check comes back next adventure. The next pair starts when this one reaches Level 3, and the next row when the whole row is gold, ending with a row challenge.'),
      el('p', {}, 'Behind the levels every hiragana still walks its own path (👀 Meet → ✍️ Trace → 🖍️ Copy → 👂 Hear it → 🔍 Read it → ✏️ Write it → 🍣 Use it → ⭐ Master); ⭐ needs correct answers on 3 separate days, because spaced practice is what makes it stick. Each adventure (8–10 min) starts with a short warm-up from earlier pairs. A child who gets nearly everything right can try the next level in the same adventure. The Dojo lets children practise any hiragana they choose.')),
    el('section', { class: 'card-sec small' }, el('h3', {}, 'Credits'),
      el('p', {}, 'Voices: VOICEVOX:四国めたん, VOICEVOX:春日部つむぎ. Stroke data: KanjiVG © Ulrich Apel (CC BY-SA 3.0). Fonts: Klee One (Fontworks), M PLUS Rounded 1c (OFL).')),
  );
}

function versionSection() {
  const info = el('p', {}, 'Version: …');
  const status = el('span', { class: 'small' });
  const btn = el('button', { class: 'btn soft' }, 'Check for updates');
  btn.onclick = async () => {
    status.textContent = 'Checking…';
    const r = await U.checkNow();
    status.textContent = { latest: 'You have the newest version.', offline: 'No internet right now.', failed: 'The download didn’t finish. It will try again next time.', unsupported: 'Updates aren’t available here.', updating: 'Updating…' }[r] || '';
  };
  U.currentVersion().then((v) => {
    info.textContent = v ? `Version ${v.version} · built ${v.built}${v.notes ? ` · ${v.notes}` : ''}` : 'Version: development copy';
  });
  return el('section', { class: 'card-sec small' }, el('h3', {}, 'App version'), info,
    el('p', {}, 'The app checks for a new version every time it starts, and again when you come back to it. New versions install only on the players or home screen, never in the middle of a game.'),
    el('div', { class: 'row-btns' }, btn, status));
}

// ================= Boot =================
async function boot() {
  await U.initUpdates();
  await U.startupCheck(); // a new version restarts the page here
  const last = S.getState().lastProfileId && S.getProfile(S.getState().lastProfileId);
  if (last) { profile = last; A.setEchoProfile(last); setLook(W.lookOf(last)); showHome(); } else showProfiles();
  U.welcomeNewVersion();
}
boot();
