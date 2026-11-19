import { el, mochi, wait, icon, holdButton, trophySVG, lanternSVG, petals, onTap, keepAwake } from './ui.js';
import * as A from './audio.js';
import * as S from './store.js';
import { KANA } from './data.js';
import {
  ROW_CHARS, introduced, mastery, rowUnlocked, rowComplete, kana, MASTERED, UNLOCK_NEXT, UNLOCK_EACH, updateTrophies, playableWords,
} from './learn.js';
import { Session, ExitError, planAdventure, finishSession } from './session.js';
import { meet, trace, listen, picwrite } from './games/core.js';
import { goldfish, memory, karuta } from './games/extra.js';
import { detective, spot, sushi, river } from './games/more.js';

const app = document.getElementById('app');
const AVATARS = ['🦊', '🐼', '🐸', '🐱', '🐰', '🐻', '🐧', '🐯', '🐨', '🦉', '🐙', '🦄'];
const COLORS = ['#e4572e', '#f3a712', '#7fb069', '#2a9d8f', '#5b7bd5', '#a26fc4'];

let profile = null;

function screen(cls, ...children) {
  const n = el('div', { class: `screen ${cls}` }, ...children);
  app.replaceChildren(n);
  keepAwake(false);
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
  const list = el('div', { class: 'profile-list' });
  for (const p of S.profiles()) {
    const t = el('button', { class: 'profile-tile', style: { '--c': p.color } },
      el('span', { class: 'avatar' }, p.avatar), el('span', { class: 'pname' }, p.name),
      el('span', { class: 'pmeta' }, `${introduced(p).length} hiragana`));
    t.addEventListener('click', () => { A.unlockAudio(); profile = p; S.setLastProfile(p.id); showHome(true); });
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
    profile = S.createProfile(name.value, avatar, color);
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
    const prog = r.chars.reduce((a, h) => a + Math.min(1, mastery(p, h) / MASTERED), 0) / r.chars.length;
    return el('div', { class: `row-dot ${unlocked ? '' : 'locked'} ${done ? 'done' : ''}`, style: { '--prog': prog } },
      el('span', {}, r.label));
  }));
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
      el('div', { class: 'home-mochi' }, m, el('div', { class: 'bubble' }, greeting)),
      el('div', { class: 'home-actions' }, adv,
        el('div', { class: 'home-tiles' },
          tile('Free play', '🎮', showFreePlay, n < 2),
          tile('Trophies', '🏆', showTrophies),
          tile('Stamps', '🔴', showStamps)))),
    rowStrip(p),
  );
  if (greet) setTimeout(() => A.say('konnichiwa'), 250);
  m.hop();
}

// ================= Adventure =================
async function runAdventure() {
  const p = profile;
  const plan = planAdventure(p);
  A.preloadChars(plan.pool);
  const s = new Session({ profile: p, root: app, steps: plan.steps.length, onExit: () => showHome() });
  try {
    for (const step of plan.steps) {
      await runStep(s, step, plan.pool, plan.fresh);
      if (s.exited) return;
      s.nextStep();
    }
  } catch (e) {
    if (e instanceof ExitError) return;
    throw e;
  }
  const result = finishSession(p, s, plan.fresh);
  await trophyCeremony(result);
  await stampEnd(s);
}

async function runStep(s, step, pool, boost) {
  switch (step.type) {
    case 'meet': return meet(s, step.h);
    case 'listen': return listen(s, { pool, boost, count: step.count });
    case 'trace': return trace(s, { pool, boost, count: step.count });
    case 'goldfish': return goldfish(s, { pool, boost, count: step.count });
    case 'picwrite': return picwrite(s, { pool, boost, count: step.count });
    case 'memory': return memory(s, { pool, boost });
    case 'karuta': return karuta(s, { pool, boost, players: [{ profile: s.p, name: s.p.name, avatar: s.p.avatar }] });
    case 'detective': return detective(s, { pool, boost, count: step.count });
    case 'spot': return spot(s, { pool, boost, count: step.count });
    case 'sushi': return sushi(s, { pool, boost, count: step.count });
    case 'river': return river(s, { pool, boost, count: step.count });
  }
}

async function trophyCeremony({ earned, rows }) {
  if (earned.length || rows.length) {
    const shelf = el('div', { class: 'ceremony-shelf' });
    const v = screen('ceremony',
      el('h2', {}, 'New trophies!'),
      shelf,
      el('div', { class: 'center' }, mochi('happy', 'md')));
    A.say('trophy');
    for (const r of rows) {
      const n = el('div', { class: 'cer-item row', html: lanternSVG(r.label, true) });
      shelf.append(n);
      A.chime(2); petals(16);
      await wait(900);
    }
    for (const t of earned.slice(0, 12)) {
      const n = el('div', { class: 'cer-item', html: trophySVG(t.h, t.level) },
        el('div', { class: 'cer-label' }, ['', 'Bronze', 'Silver', 'Gold'][t.level]));
      shelf.append(n);
      A.chime(t.level >= 2 ? 1 : 0);
      if (t.level === 3) petals(10);
      await wait(650);
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
    el('div', { class: 'stamp-end-top' }, m, el('div', { class: 'bubble' }, `Great work today! You got ${s.correctCount} right.`)),
    card,
    el('div', { class: 'center' }, done));
  await wait(600);
  A.stampThunk();
  card.querySelector('.stamp.new')?.classList.add('land');
  await wait(500);
  A.say('ganbatta');
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
    el('div', { class: 'stamp-card-title' }, `Stamp card ${cardIdx + 1}`, el("span", {}, `${total} ${total === 1 ? "adventure" : "adventures"}`)),
    el('div', { class: 'stamp-grid' }, ...slots));
}

// ================= Free play =================
const GAMES = [
  { id: 'listen', name: 'Listen & Pick', emoji: '👂', min: 2 },
  { id: 'detective', name: 'Sound Detective', emoji: '🔍', min: 2 },
  { id: 'trace', name: 'Trace', emoji: '✍️', min: 1 },
  { id: 'picwrite', name: 'Picture Write', emoji: '🖼️', min: 1 },
  { id: 'goldfish', name: 'Goldfish Scoop', emoji: '🐟', min: 2 },
  { id: 'spot', name: 'Spot the Different One', emoji: '👀', min: 2 },
  { id: 'river', name: 'Stepping Stones', emoji: '🪨', words: 2 },
  { id: 'sushi', name: 'Sushi Train', emoji: '🍣', words: 2 },
  { id: 'memory', name: 'Memory Match', emoji: '🃏', min: 2 },
  { id: 'karuta', name: 'Karuta', emoji: '🎴', min: 4 },
];
const COUNTS = { trace: 4, picwrite: 4, detective: 6, spot: 5, river: 3, sushi: 4 };
function showFreePlay() {
  const p = profile;
  const pool = introduced(p);
  const nWords = playableWords(pool).length;
  const grid = el('div', { class: 'game-grid g10' }, ...GAMES.map((g) => {
    const ok = g.words ? nWords >= g.words : pool.length >= g.min;
    const b = el('button', { class: 'game-tile' + (ok ? '' : ' locked'), disabled: !ok },
      el('span', { class: 'emoji' }, g.emoji), el('span', { class: 'gname' }, g.name),
      ok ? null : el('span', { class: 'need' }, g.words ? 'Learn a few more hiragana' : `Learn ${g.min} hiragana`));
    b.onclick = () => (g.id === 'karuta' ? showKarutaSetup() : runSingle(g.id));
    return b;
  }));
  screen('freeplay', el('div', { class: 'topline' }, backBtn(() => showHome()), el('h2', {}, 'Free play')), grid);
}

async function runSingle(id) {
  const p = profile;
  const pool = introduced(p);
  A.preloadChars(pool);
  const s = new Session({ profile: p, root: app, steps: 1, onExit: showFreePlay });
  try {
    await runStep(s, { type: id, count: COUNTS[id] || 8 }, pool, []);
  } catch (e) {
    if (e instanceof ExitError) return;
    throw e;
  }
  await trophyCeremony(updateTrophies(p));
  showFreePlay();
}

function showKarutaSetup() {
  const p = profile;
  const others = S.profiles().filter((x) => x.id !== p.id);
  const start = async (players) => {
    const pool = introduced(p);
    A.preloadChars(pool);
    const s = new Session({ profile: p, root: app, steps: 1, onExit: showFreePlay });
    try {
      await karuta(s, { pool, boost: [], players });
    } catch (e) {
      if (e instanceof ExitError) return;
      throw e;
    }
    for (const pl of players) if (pl.profile && pl.profile !== p) updateTrophies(pl.profile);
    await trophyCeremony(updateTrophies(p));
    showFreePlay();
  };
  const me = { profile: p, name: p.name, avatar: p.avatar };
  const opts = el('div', { class: 'karuta-opts' },
    (() => { const b = el('button', { class: 'game-tile' }, el('span', { class: 'emoji' }, '🐰'), el('span', { class: 'gname' }, 'Play against Mochi')); b.onclick = () => start([me]); return b; })(),
    ...others.map((o) => { const b = el('button', { class: 'game-tile' }, el('span', { class: 'emoji' }, o.avatar), el('span', { class: 'gname' }, `Play with ${o.name}`)); b.onclick = () => start([me, { profile: o, name: o.name, avatar: o.avatar }]); return b; }),
    (() => { const b = el('button', { class: 'game-tile' }, el('span', { class: 'emoji' }, '🧑'), el('span', { class: 'gname' }, 'Play with a grown-up')); b.onclick = () => start([me, { profile: null, name: 'Grown-up', avatar: '🧑' }]); return b; })(),
  );
  screen('karuta-setup', el('div', { class: 'topline' }, backBtn(showFreePlay), el('h2', {}, 'Karuta かるた')),
    el('p', { class: 'hint-text' }, 'Listen to the reader, then grab the right card first! Two players: sit opposite each other with the tablet flat between you.'),
    opts);
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
        const t = el('button', { class: 'trophy', 'aria-label': h, html: trophySVG(h, lvl) });
        if (S.settings().romaji && lvl) t.append(el('span', { class: 'romaji' }, kana(h).r));
        if (lvl) onTap(t, () => { A.sayKana(h); t.classList.remove('wiggle'); void t.offsetWidth; t.classList.add('wiggle'); });
        return t;
      })));
  });
  const counts = [1, 2, 3].map((l) => Object.values(p.trophies).filter((x) => x === l).length);
  screen('trophies',
    el('div', { class: 'topline' }, backBtn(() => showHome()), el('h2', {}, `${p.name}’s Trophy Room`),
      el('div', { class: 'tcount' },
        el('span', { class: 'b' }, `● ${counts[0]}`), el('span', { class: 's' }, `● ${counts[1]}`), el('span', { class: 'g' }, `● ${counts[2]}`))),
    el('p', { class: 'hint-text' }, 'Bronze: you met it · Silver: getting strong · Gold: whole row mastered'),
    el('div', { class: 'shelves' }, ...shelves));
}

function showStamps() {
  const p = profile;
  screen('stamps', el('div', { class: 'topline' }, backBtn(() => showHome()), el('h2', {}, 'Stamp card')),
    stampCard(p),
    el('p', { class: 'hint-text' }, 'Finish an Adventure to get a stamp!'));
}

// ================= Parent area =================
function showParent() {
  const st = S.settings();
  const vol = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st.volume });
  vol.oninput = () => S.setSetting('volume', +vol.value);
  vol.onchange = () => A.sayKana('あ');
  const toggle = (key, label) => {
    const c = el('input', { type: 'checkbox' });
    c.checked = !!st[key];
    c.onchange = () => S.setSetting(key, c.checked);
    return el('label', { class: 'toggle' }, c, label);
  };
  const plist = el('div', { class: 'parent-profiles' }, ...S.profiles().map((p) => {
    const table = el('table', { class: 'progress-table' },
      el('tr', {}, el('th', {}, ''), el('th', {}, 'Sound'), el('th', {}, 'Hear'), el('th', {}, 'Write'), el('th', {}, 'Overall')),
      ...KANA.filter((k) => p.chars[k.h] && p.chars[k.h].intro).map((k) => {
        const c = p.chars[k.h];
        const pc = (x) => Math.round(x * 100) + '%';
        return el('tr', {}, el('td', { class: 'kana' }, k.h), el('td', {}, k.r), el('td', {}, pc(c.hear)), el('td', {}, pc(c.write)),
          el('td', {}, el('span', { class: 'bar', style: { '--v': mastery(p, k.h) } }), pc(mastery(p, k.h))));
      }));
    const locked = ROW_CHARS.findIndex((r, i) => !rowUnlocked(p, i));
    return el('details', { class: 'pp' },
      el('summary', {}, el('span', { class: 'avatar' }, p.avatar), `${p.name} — ${introduced(p).length} hiragana, ${p.stamps.length} sessions, best streak ${p.bestStreak || 0}`),
      locked > 0 ? el('p', { class: 'small' }, `Next row (${ROW_CHARS[locked].label}) unlocks when the ${ROW_CHARS[locked - 1].label} row averages ${UNLOCK_NEXT * 100}% and every character in it is at least ${UNLOCK_EACH * 100}%.`) : null,
      table,
      el('div', { class: 'row-btns' },
        holdButton('Hold to reset progress', 2500, () => { S.resetProfile(p.id); showParent(); }, 'warn'),
        holdButton('Hold to delete player', 2500, () => { S.deleteProfile(p.id); showParent(); }, 'warn')));
  }));
  screen('parent',
    el('div', { class: 'topline' }, backBtn(showProfiles), el('h2', {}, 'Grown-ups')),
    el('section', { class: 'card-sec' }, el('h3', {}, 'Settings'),
      el('label', { class: 'slider' }, 'Volume', vol),
      toggle('romaji', 'Show romaji hints to kids'),
      toggle('reducedMotion', 'Calmer animations')),
    el('section', { class: 'card-sec' }, el('h3', {}, 'Players'), plist),
    el('section', { class: 'card-sec small' }, el('h3', {}, 'How it works'),
      el('p', {}, 'Each Adventure is about 8–10 minutes. Children meet 1–2 new hiragana per session, only when the ones they know are getting solid. Each character tracks two skills: recognising it by sound and writing it. Rows unlock in order (あ → か → さ …). Practising on separate days is what moves a character to silver and gold (a skill can reach 45% on its first day, 65% after two days, 85% after three), because spaced practice is what makes hiragana stick.')),
    el('section', { class: 'card-sec small' }, el('h3', {}, 'Credits'),
      el('p', {}, 'Voices: VOICEVOX:四国めたん, VOICEVOX:春日部つむぎ. Stroke data: KanjiVG © Ulrich Apel (CC BY-SA 3.0). Fonts: Klee One (Fontworks), M PLUS Rounded 1c (OFL).')),
  );
}

// ================= Boot =================
const last = S.getState().lastProfileId && S.getProfile(S.getState().lastProfileId);
if (last) { profile = last; showHome(); } else showProfiles();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
