// Goldfish Scoop, Memory Match, Karuta.
import { said, el, mochi, wait, speakerIcon, onTap, reduced } from '../ui.js';
import * as A from '../audio.js';
import { kana, record, pickTargets, distractors, shuffle } from '../learn.js';
import { save } from '../store.js';
import { guard } from '../session.js';

function speaker(fn, cls = '') {
  const b = el('button', { class: `speaker ${cls}`, 'aria-label': 'Play sound', html: speakerIcon() });
  onTap(b, () => { b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); fn(); });
  return b;
}

// ======================= Goldfish Scoop (金魚すくい) =======================
const FISH_COLORS = ['#f26b3a', '#f39a3d', '#e8524f', '#f5b041', '#ee7752'];
function fishSVG(color) {
  return `<svg viewBox="0 0 160 100" class="fish-svg">
    <ellipse cx="80" cy="92" rx="58" ry="7" fill="#0b3a50" opacity=".18"/>
    <path d="M118 50 L154 22 Q146 50 154 78 Z" fill="${color}" opacity=".85"/>
    <ellipse cx="72" cy="50" rx="56" ry="38" fill="${color}"/>
    <path d="M60 14 Q78 0 96 16" fill="${color}" opacity=".8"/>
    <circle cx="28" cy="42" r="6" fill="#2b2b3a"/><circle cx="26.5" cy="40" r="2" fill="#fff"/>
    <circle cx="80" cy="50" r="30" fill="#fffaf0"/>
  </svg>`;
}

export async function goldfish(s, { pool, boost = [], only = null, count = 6 }) {
  const p = s.p;
  const targets = pickTargets(p, pool, count, boost, only);
  const bowlCount = el('span', { class: 'bowl-count' }, '0');
  const bowl = el('div', { class: 'bowl' }, el('span', { class: 'emoji' }, '🥣'), bowlCount);
  const pond = el('div', { class: 'pond' });
  const sp = speaker(() => A.tapKana(cur), 'lg');
  const v = s.view('goldfish', el('div', { class: 'gf-top' }, sp, el('div', { class: 'bubble' }, 'Scoop the fish that says…'), bowl), pond);
  let cur = null;
  let fishes = [];
  let raf = 0;
  let caught = 0;
  let last = performance.now();

  function loop(t) {
    if (s.exited || !pond.isConnected) return; // player left: stop animating
    const dt = Math.min(50, t - last) / 1000;
    last = t;
    const W = pond.clientWidth, H = pond.clientHeight;
    for (const f of fishes) {
      if (f.gone) continue;
      f.t += dt;
      f.x += f.vx * dt * (f.dart ? 4 : 1);
      f.y += Math.sin(f.t * f.wob) * 12 * dt;
      const fw = f.node.offsetWidth || 120;
      if (!f.dart) {
        if (f.x < 0) { f.x = 0; f.vx = Math.abs(f.vx); }
        if (f.x > W - fw) { f.x = W - fw; f.vx = -Math.abs(f.vx); }
      }
      f.y = Math.max(0, Math.min(H - fw * 0.62, f.y));
      f.node.style.transform = `translate(${f.x}px, ${f.y}px)`;
      f.body.style.transform = `scaleX(${f.vx > 0 ? -1 : 1})`;
    }
    raf = requestAnimationFrame(loop);
  }

  function spawn(h) {
    const hear = (p.chars[h] || {}).hear || 0;
    const n = Math.min(pool.length, hear < 0.4 ? 3 : 4);
    const chars = shuffle([h, ...distractors(h, pool, n - 1, hear > 0.4)]);
    fishes.forEach((f) => { f.gone = true; f.node.classList.add('leave'); setTimeout(() => f.node.remove(), 600); });
    const W = pond.clientWidth, H = pond.clientHeight;
    const lane = H / chars.length;
    fishes = chars.map((c, i) => {
      const body = el('div', { class: 'fish-body', html: fishSVG(FISH_COLORS[(i + caught) % FISH_COLORS.length]) });
      // .fish moves (transform set every frame); .fish-inner handles the scoop animation.
      const node = el('button', { class: 'fish', 'aria-label': 'fish' },
        el('div', { class: 'fish-inner' }, body, el('span', { class: 'fish-label' }, c)));
      const speed = reduced() ? 18 : 30 + Math.random() * 30;
      const f = { c, node, body, x: Math.random() * Math.max(10, W - 200), y: lane * i + Math.random() * lane * 0.2, vx: (Math.random() < 0.5 ? -1 : 1) * speed, t: Math.random() * 6, wob: 1 + Math.random(), dart: false, gone: false };
      pond.append(node);
      return f;
    });
    return fishes;
  }

  raf = requestAnimationFrame(loop);
  try {
    for (const h of targets) {
      guard(s);
      cur = h;
      v.dataset.target = h;
      let firstTry = true;
      const fs = spawn(h);
      A.sayKana(h, { lead: 700 });
      await new Promise((done) => {
        fs.forEach((f) => onTap(f.node, async () => {
          if (f.gone || f.dart) return;
          if (f.c === h) {
            fs.forEach((x) => (x.gone = x === f ? true : x.gone));
            f.gone = true;
            A.splash();
            record(p, h, 'hear', firstTry, 0.15);
            if (firstTry) s.correct(h); else A.chime(0);
            f.node.classList.add('scooped');
            caught++;
            bowlCount.textContent = caught;
            bowl.classList.remove('bump'); void bowl.offsetWidth; bowl.classList.add('bump');
            await wait(1300);
            done();
          } else {
            if (firstTry) { record(p, h, 'hear', false); s.miss(h); }
            firstTry = false;
            A.splash();
            f.dart = true;
            f.vx = f.vx || 40;
            f.node.classList.add('swim-off');
            setTimeout(() => { f.gone = true; f.node.remove(); }, 900);
            A.sayKana(h, { lead: 500 });
          }
        }));
      });
    }
  } finally {
    cancelAnimationFrame(raf);
  }
  void v;
  await wait(200);
}

// ======================= Memory Match =======================
export async function memory(s, { pool, boost = [], only = null }) {
  const p = s.p;
  const avgHear = pool.reduce((a, h) => a + ((p.chars[h] || {}).hear || 0), 0) / pool.length;
  const mode = pool.length < 3 ? 'same' : avgHear > 0.45 && Math.random() < 0.5 ? 'sound' : 'picture';
  const nPairs = Math.min(6, pool.length);
  const chars = [...new Set([...(only || []), ...boost.filter((h) => pool.includes(h)), ...pickTargets(p, pool, nPairs * 3, boost)])].slice(0, nPairs);
  while (chars.length < Math.min(nPairs, pool.length)) {
    const extra = pool.find((h) => !chars.includes(h));
    if (!extra) break;
    chars.push(extra);
  }
  const cards = shuffle(chars.flatMap((h) => [
    { h, face: 'kana' },
    { h, face: mode === 'same' ? 'kana' : mode },
  ]));
  let open = [];
  let matched = 0;
  let lock = false;
  const title = { same: 'Find the pairs!', picture: 'Match each hiragana to its picture!', sound: 'Match each hiragana to its sound!' }[mode];
  const grid = el('div', { class: `mem-grid c${cards.length}` });
  s.view('memory', el('div', { class: 'bubble center' }, title), grid);
  await new Promise((done) => {
    cards.forEach((c) => {
      const front = c.face === 'kana'
        ? el('span', { class: 'kana' }, c.h)
        : c.face === 'picture'
          ? el('span', { class: 'emoji' }, kana(c.h).emoji)
          : el('span', { class: 'snd', html: speakerIcon() });
      const inner = el('div', { class: 'card-inner' }, el('div', { class: 'card-back' }), el('div', { class: `card-front f-${c.face}` }, front));
      const node = el('button', { class: 'card', 'aria-label': 'card', 'data-h': c.h }, inner);
      c.node = node;
      // Cheap 2D flip: squash to 0 width, swap faces, grow back (no 3D layers on the tablet GPU).
      node.flip = async (up) => {
        inner.classList.add('squash');
        await wait(130);
        node.classList.toggle('flipped', up);
        inner.classList.remove('squash');
      };
      onTap(node, async () => {
        if (lock || c.open || c.done) return;
        c.open = true;
        node.flip(true);
        A.pop();
        if (c.face === 'picture') A.tapWord(c.h); else A.tapKana(c.h);
        open.push(c);
        if (open.length < 2) return;
        lock = true;
        const [a, b] = open;
        open = [];
        await wait(700);
        if (a.h === b.h) {
          a.done = b.done = true;
          a.node.classList.add('matched'); b.node.classList.add('matched');
          record(p, a.h, 'hear', true, 0.08);
          s.practise(a.h);   // a Memory match is partly luck: no streak, no koban
          matched++;
          lock = false;
          if (matched === chars.length) { await wait(900); done(); }
        } else {
          await wait(700);
          a.open = b.open = false;
          a.node.flip(false); b.node.flip(false);
          lock = false;
        }
      });
      grid.append(node);
    });
  });
  grid.previousElementSibling?.replaceChildren(...said('yokudekimashita'));
  A.say('yokudekimashita', { lead: 600 });
  await wait(2200);
}

// ======================= Karuta (かるた) =======================
// players: [{ profile|null, name, avatar }]. One player = against Mochi.
export async function karuta(s, { pool, boost = [], only = null, players }) {
  const solo = players.length === 1;
  const nCards = Math.min(6, pool.length);
  const chars = [...new Set([...(only || []).slice(0, nCards), ...boost.filter((h) => pool.includes(h)), ...pickTargets(s.p, pool, nCards * 3, boost)])].slice(0, nCards);
  while (chars.length < nCards) chars.push(pool.find((h) => !chars.includes(h)));
  const order = shuffle(chars);
  const score = players.map(() => 0);
  let mochiScore = 0;

  const sides = players.map((pl, i) => {
    const grid = el('div', { class: 'k-grid' });
    const pile = el('span', { class: 'k-pile' }, '0');
    const side = el('div', { class: `k-side p${i} ${!solo && i === 1 ? 'flip' : ''}` },
      el('div', { class: 'k-name' }, el('span', { class: 'emoji' }, pl.avatar), pl.name, pile), grid);
    const cardNodes = {};
    shuffle(chars).forEach((h) => {
      const c = el('button', { class: 'k-card', 'aria-label': 'card', 'data-h': h }, el('span', { class: 'kana' }, h));
      cardNodes[h] = c;
      grid.append(c);
    });
    return { side, grid, pile, cardNodes, locked: false };
  });

  const m = mochi('idle', 'md');
  const paw = el('div', { class: 'paw-bar' }, el('div', { class: 'paw-fill' }));
  const mochiPile = el('span', { class: 'k-pile' }, '0');
  const reader = speaker(() => cur && A.tapKana(cur), 'lg');
  const mid = el('div', { class: 'k-mid' }, reader,
    solo ? el('div', { class: 'k-mochi' }, m, el('div', {}, el('div', { class: 'k-name' }, 'Mochi', mochiPile), paw)) : null);
  s.view(`karuta ${solo ? 'solo' : 'duo'}`, ...(solo ? [mid, sides[0].side] : [sides[1].side, mid, sides[0].side]));

  let cur = null;
  const fill = paw.firstChild;
  for (const h of order) {
    guard(s);
    cur = h;
    s.stage.dataset.target = h;
    await wait(1200);
    A.sayKana(h);
    const winner = await new Promise((res) => {
      let over = false;
      let timer = null;
      const finish = (w) => { if (over) return; over = true; clearTimeout(timer); res(w); };
      if (solo) {
        const t = s.p.mochiSpeed || 5200;
        fill.style.transition = 'none'; fill.style.transform = 'scaleX(0)'; void fill.offsetWidth;
        fill.style.transition = `transform ${t}ms linear`; fill.style.transform = 'scaleX(1)';
        timer = setTimeout(() => finish(-1), t + 400);
      }
      sides.forEach((sd, i) => {
        Object.entries(sd.cardNodes).forEach(([ch, node]) => {
          node.onpointerdown = (e) => {
            e.preventDefault();
            if (over || sd.locked || node.classList.contains('taken')) return;
            if (ch === h) finish(i);
            else {
              node.classList.remove('wiggle'); void node.offsetWidth; node.classList.add('wiggle');
              sd.locked = true;
              sd.side.classList.add('wait');
              const pr = players[i].profile;
              if (pr) record(pr, h, 'hear', false);
              if (i === 0 || !solo) s.miss(h);
              setTimeout(() => { sd.locked = false; sd.side.classList.remove('wait'); }, 900);
            }
          };
        });
      });
    });
    fill.style.transition = 'none';
    fill.style.transform = 'scaleX(0)';
    sides.forEach((sd) => sd.cardNodes[h].classList.add('taken'));
    if (winner >= 0) {
      score[winner]++;
      sides[winner].pile.textContent = score[winner];
      sides[winner].cardNodes[h].classList.add('won');
      const pr = players[winner].profile;
      if (pr) record(pr, h, 'hear', true, 0.15);
      s.correct(h, players[winner].profile);
      A.say('totta', { lead: 300 });
      if (solo) { s.p.mochiSpeed = Math.max(2200, (s.p.mochiSpeed || 5200) - 150); save(); }
    } else {
      mochiScore++;
      mochiPile.textContent = mochiScore;
      m.setMood('happy'); m.hop();
      setTimeout(() => m.setMood('idle'), 900);
      A.sayKana(h);
      s.p.mochiSpeed = Math.min(7000, (s.p.mochiSpeed || 5200) + 400);
      save();
    }
    await wait(900);
  }
  // Result
  const lines = solo
    ? [`${players[0].name}: ${score[0]}`, `Mochi: ${mochiScore}`]
    : players.map((pl, i) => `${pl.name}: ${score[i]}`);
  const top = Math.max(...score, solo ? mochiScore : 0);
  const msg = solo
    ? (score[0] >= mochiScore ? 'You won! Mochi says: great game!' : 'Mochi got more this time. Great game!')
    : (score[0] === score[1] ? 'A tie! Great game!' : `${players[score[0] > score[1] ? 0 : 1].name} wins! Great game!`);
  s.view('karuta-end',
    mochi('happy', 'lg'),
    el('div', { class: 'bubble center' }, ...said('yokudekimashita', msg)),
    el('div', { class: 'k-results' }, ...lines.map((l) => el('div', { class: 'k-res' }, l))),
  );
  void top;
  A.say('yokudekimashita', { lead: 600 });
  await wait(3000);
}
