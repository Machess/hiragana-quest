// Sound Detective, Spot the Different One, Sushi Train, River Stepping Stones.
// Layout is for the 1280x800 stage; animations use transform/opacity only.
import { el, mochi, wait, speakerIcon, onTap } from '../ui.js';
import * as A from '../audio.js';
import { record, pickTargets, distractors, shuffle, lookalikePairs, mastery, playableWords } from '../learn.js';
import { guard } from '../session.js';
import { WORDS } from '../vocab.js';

function speaker(fn, cls = '') {
  const b = el('button', { class: `speaker ${cls}`, 'aria-label': 'Play sound', html: speakerIcon() });
  onTap(b, () => { b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); fn(); });
  return b;
}
const bubble = (t, cls = '') => el('div', { class: `bubble ${cls}` }, t);
const hearOf = (p, h) => (p.chars[h] || {}).hear || 0;
function restart(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }

// Prefer words that use weak or brand-new characters.
function pickWords(p, pool, n, boost = [], opts, only = null) {
  let words = playableWords(pool, opts);
  if (only && only.length) { const f = words.filter((w) => [...w.w].some((c) => only.includes(c))); if (f.length) words = f; }
  const score = (w) => [...w.w].reduce((a, c) => a + (1.1 - mastery(p, c)) + (boost.includes(c) ? 1.5 : 0), 0) / w.w.length + Math.random() * 0.6;
  return words.map((w) => [score(w), w]).sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
}

// ======================= Sound Detective (see a character, find its sound) =======================
const OPTION_COLORS = ['#f6b7c4', '#9fd0a0', '#9cc8e8', '#f3cf6a'];
export async function detective(s, { pool, boost = [], only = null, count = 5 }) {
  const p = s.p;
  const targets = pickTargets(p, pool, count, boost, only);
  let first = true;
  for (const h of targets) {
    guard(s);
    const hear = hearOf(p, h);
    const n = Math.min(pool.length, hear < 0.4 ? 2 : 3);
    const options = shuffle([h, ...distractors(h, pool, n - 1, true)]);
    const m = mochi('idle', 'md');
    let firstTry = true;
    await new Promise((done) => {
      const cards = options.map((o, i) => {
        const play = speaker(() => A.tapKana(o), 'lg');
        const pick = el('button', { class: 'det-pick' }, 'This one!');
        const card = el('div', { class: 'det-option', style: { '--c': OPTION_COLORS[i] } }, play, pick);
        onTap(pick, async () => {
          if (card.classList.contains('nope') || card.classList.contains('yes')) return;
          if (o === h) {
            card.classList.add('yes');
            cards.forEach((c) => c.classList.add('locked'));
            record(p, h, 'read', firstTry, 0.18);
            if (firstTry) s.correct(h); else A.chime(0);
            m.setMood('happy'); m.hop();
            await A.sayKana(h, { lead: 450 });
            await wait(1100);
            done();
          } else {
            if (firstTry) { record(p, h, 'read', false); s.miss(h); }
            firstTry = false;
            card.classList.add('nope');
          }
        });
        return card;
      });
      const v = s.view('detective',
        el('div', { class: 'det-left' },
          el('div', { class: 'det-card' }, el('span', { class: 'kana' }, h), el('span', { class: 'det-glass emoji' }, '🔍')),
          el('div', { class: 'det-mochi' }, m, bubble('Which sound does it make? Listen, then pick!'))),
        el('div', { class: `det-options n${options.length}` }, ...cards));
      v.dataset.target = h;
      v.dataset.options = options.join('');
      if (first) { first = false; A.say('dorenooto'); }
    });
  }
}

// ======================= Spot the Different One =======================
export async function spot(s, { pool, boost = [], only = null, count = 5 }) {
  const p = s.p;
  const pairs = shuffle(lookalikePairs(pool, only));
  const sizes = [[3, 3], [4, 3], [5, 3], [6, 3], [6, 3]];
  for (let round = 0; round < count; round++) {
    guard(s);
    let pair = pairs.length ? pairs[round % pairs.length] : null;
    if (!pair) {
      const a = pickTargets(p, pool, 1, boost, only)[0];
      pair = [a, distractors(a, pool, 1, false)[0]];
    }
    const [same, odd] = Math.random() < 0.5 ? pair : [pair[1], pair[0]];
    const [cols, rows] = sizes[Math.min(round, sizes.length - 1)];
    const total = cols * rows;
    const oddAt = Math.floor(Math.random() * total);
    let firstTry = true;
    const msg = bubble('Find the one that’s different!');
    await new Promise((done) => {
      const cells = Array.from({ length: total }, (_, i) => {
        const c = i === oddAt ? odd : same;
        const b = el('button', { class: 'spot-cell', 'data-h': c, style: { '--tilt': (Math.random() * 10 - 5).toFixed(1) + 'deg' } },
          el('span', { class: 'kana' }, c));
        onTap(b, async () => {
          if (b.classList.contains('found')) return;
          if (i === oddAt) {
            b.classList.add('found');
            grid.classList.add('solved');
            record(p, odd, 'read', firstTry, 0.12);
            if (firstTry) record(p, same, 'read', true, 0.06);
            if (firstTry) s.correct(odd); else A.chime(0);
            msg.replaceChildren(el('span', { class: 'kana pair' }, odd), ' is not ', el('span', { class: 'kana pair' }, same));
            await A.sayKana(odd, { lead: 450 });
            await A.sayKana(same, { gap: 900 });
            await wait(1300);
            done();
          } else {
            if (firstTry) s.miss(odd);
            firstTry = false;
            restart(b, 'wiggle');
          }
        });
        return b;
      });
      const grid = el('div', { class: 'spot-grid', style: { '--cols': cols } }, ...cells);
      const v = s.view('spot', el('div', { class: 'spot-top' }, mochi('idle', 'md'), msg), grid);
      v.dataset.target = odd;
      if (round === 0) A.say('chigau', { lead: 400 });
    });
  }
}

// ======================= Sushi Train (回転寿司) =======================
const CUSTOMERS = ['🧒', '👧', '👦', '👴', '👵', '👩', '👨', '🧑‍🍳'];
export async function sushi(s, { pool, boost = [], only = null, count = 3 }) {
  const p = s.p;
  const words = pickWords(p, pool, count, boost, { max: 4 }, only);
  const HALF = 8;           // plates per half of the belt (the belt is two identical halves)
  const belt = el('div', { class: 'belt-track' });
  const plates = [];        // [{ node, kana, i }] for both halves
  for (let half = 0; half < 2; half++) {
    for (let i = 0; i < HALF; i++) {
      const k = el('span', { class: 'kana' });
      const node = el('button', { class: 'plate', 'aria-label': 'plate' }, el('div', { class: 'plate-dish' }), k);
      belt.append(node);
      plates.push({ node, k, i });
    }
  }
  const slotsRow = el('div', { class: 'sushi-slots' });
  const orderPic = el('div', { class: 'order-pic emoji' });
  const customer = el('div', { class: 'customer emoji' });
  const sp = speaker(() => cur && A.tapVocab(cur.id), 'lg');
  const v = s.view('sushi',
    el('div', { class: 'sushi-counter' },
      customer,
      el('div', { class: 'order' }, orderPic, slotsRow),
      sp),
    el('div', { class: 'belt' }, belt));
  let cur = null;
  const contents = new Array(HALF).fill('');
  const setPlate = (i, c) => {
    contents[i] = c;
    plates.filter((x) => x.i === i).forEach((x) => { x.k.textContent = c; x.node.dataset.h = c; x.node.classList.remove('taken'); });
  };
  const fillFor = (need) => {
    // every still-needed char is on the belt (at least once per half), the rest are distractors
    const others = pool.filter((c) => !need.includes(c));
    const fillers = [];
    for (let i = 0; fillers.length < HALF - need.length; i++) {
      const src = others.length ? others : pool;
      fillers.push(src[(i + Math.floor(Math.random() * src.length)) % src.length]);
    }
    shuffle([...need, ...fillers]).forEach((c, i) => setPlate(i, c));
  };

  for (const w of words) {
    guard(s);
    cur = w;
    v.dataset.target = w.w;
    const chars = [...w.w];
    customer.textContent = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
    restart(customer, 'arrive');
    orderPic.textContent = w.emoji;
    const slots = chars.map(() => el('span', { class: 'sushi-slot' }));
    slotsRow.replaceChildren(...slots);
    let idx = 0;
    let firstTry = true;
    let wordMisses = 0;
    fillFor(chars);
    await wait(600);
    A.sayVocab(w.id, { lead: 300 });
    await new Promise((done) => {
      plates.forEach((pl) => {
        pl.node.onpointerdown = async (e) => {
          e.preventDefault();
          if (idx >= chars.length || pl.node.classList.contains('taken')) return;
          const c = contents[pl.i];
          if (c === chars[idx]) {
            plates.filter((x) => x.i === pl.i).forEach((x) => x.node.classList.add('taken'));
            slots[idx].textContent = c;
            slots[idx].classList.add('filled');
            record(p, c, 'hear', firstTry, 0.12);
            if (firstTry) s.correct(c); else A.pop();
            A.sayKana(c);
            idx++;
            firstTry = true;
            // put a fresh dish where this one was, keeping the remaining needed chars on the belt
            const remaining = chars.slice(idx);
            const onBelt = (ch) => contents.filter((x, j) => x === ch && j !== pl.i).length;
            const missing = remaining.find((ch) => onBelt(ch) < remaining.filter((x) => x === ch).length);
            const refill = missing || shuffle(pool)[0];
            setTimeout(() => setPlate(pl.i, refill), 700);
            if (idx >= chars.length) {
              if (wordMisses <= 1) chars.forEach((ch) => record(p, ch, 'use', true, 0.1));
              await wait(500);
              customer.classList.add('happy');
              await A.sayVocab(w.id, { gap: 900 });
              A.say(Math.random() < 0.5 ? 'oishii' : 'arigatou', { gap: 600 });
              await wait(2000);
              customer.classList.remove('happy');
              done();
            }
          } else {
            if (firstTry) { record(p, chars[idx], 'hear', false); s.miss(chars[idx]); wordMisses++; }
            firstTry = false;
            restart(pl.node, 'wiggle');
            A.sayKana(chars[idx], { lead: 500 });
          }
        };
      });
    });
  }
}

// ======================= River Stepping Stones (川渡り) =======================
export async function river(s, { pool, boost = [], only = null, count = 3 }) {
  const p = s.p;
  const words = pickWords(p, pool, count, boost, { max: 4 }, only);
  const W = 1232, H = 690;                 // stage area below the top bar
  const BANK_L = 150, BANK_R = 190;
  const LANES = [150, 345, 540];           // stone centre y positions
  const water = el('div', { class: 'river-water' }, el('div', { class: 'river-waves' }));
  const stonesLayer = el('div', { class: 'river-stones' });
  const goal = el('div', { class: 'river-goal' });
  const hop = mochi('idle', 'sm');
  const walker = el('div', { class: 'river-mochi' }, hop);
  const sp = speaker(() => cur && A.tapKana(cur), 'lg');
  const v = s.view('river',
    el('div', { class: 'river-scene' },
      el('div', { class: 'bank left' }), water, el('div', { class: 'bank right' }, goal),
      stonesLayer, walker),
    el('div', { class: 'river-hud' }, sp));
  let cur = null;
  const place = (x, y) => { walker.style.transform = `translate(${x - 42}px, ${y - 88}px)`; };
  const jump = () => { restart(walker, 'jumping'); };

  for (const w of words) {
    guard(s);
    const chars = [...w.w];
    stonesLayer.replaceChildren();
    goal.replaceChildren();
    goal.classList.remove('show');
    walker.classList.add('no-move');
    place(BANK_L / 2, LANES[1]);
    void walker.offsetWidth;
    walker.classList.remove('no-move');
    const step = (W - BANK_L - BANK_R) / chars.length;
    let wordMisses = 0;
    v.dataset.word = w.w;
    for (let i = 0; i < chars.length; i++) {
      guard(s);
      const h = chars[i];
      cur = h;
      v.dataset.target = h;
      const x = BANK_L + step * (i + 0.5);
      const n = Math.min(pool.length, hearOf(p, h) < 0.35 ? 2 : 3);
      const opts = shuffle([h, ...distractors(h, pool, n - 1, hearOf(p, h) > 0.4)]);
      const lanes = n === 2 ? shuffle([LANES[0], LANES[2]]) : shuffle(LANES);
      let firstTry = true;
      await new Promise((done) => {
        const stones = opts.map((o, j) => {
          const st = el('button', { class: 'stone-btn', 'data-h': o, style: { left: `${x - 70}px`, top: `${lanes[j] - 52}px` } },
            el('span', { class: 'kana' }, o));
          onTap(st, async () => {
            if (st.classList.contains('sunk') || stones.some((z) => z.classList.contains('chosen'))) return;
            if (o === h) {
              st.classList.add('chosen');
              stones.forEach((z) => z !== st && z.classList.add('gone'));
              record(p, h, 'hear', firstTry, 0.15);
              if (firstTry) s.correct(h); else A.pop();
              jump();
              place(x, lanes[j]);
              A.sayKana(h, { lead: 200 });
              await wait(1000);
              stones.forEach((z) => z !== st && z.remove());
              done();
            } else {
              if (firstTry) { record(p, h, 'hear', false); s.miss(h); wordMisses++; }
              firstTry = false;
              A.splash();
              st.classList.add('sunk');
              setTimeout(() => st.classList.remove('sunk'), 1100);
              A.sayKana(h, { lead: 600 });
            }
          });
          stonesLayer.append(st);
          return st;
        });
        A.sayKana(h, { lead: 700 });
      });
    }
    // Reach the far bank: the stones spell the word.
    await wait(200);
    jump();
    place(W - BANK_R / 2, LANES[1]);
    await wait(550);
    goal.replaceChildren(el('div', { class: 'goal-pic emoji' }, w.emoji), el('div', { class: 'goal-word kana' }, w.w));
    goal.classList.add('show');
    hop.setMood('happy');
    A.chime(1);
    if (wordMisses <= 1) chars.forEach((ch) => record(p, ch, 'use', true, 0.1));
    await A.sayVocab(w.id, { lead: 500 });
    A.say('tsuita', { gap: 700 });
    await wait(2200);
    hop.setMood('idle');
  }
}

// ======================= Read & Match (read a word, no sound → pick its picture) =======================
export async function readmatch(s, { pool, boost = [], only = null, count = 4 }) {
  const p = s.p;
  const words = pickWords(p, pool, count, boost, { max: 4 }, only);
  for (const w of words) {
    guard(s);
    const others = shuffle(WORDS.filter((x) => x.emoji !== w.emoji && x.w !== w.w)).slice(0, 2);
    const options = shuffle([w, ...others]);
    let misses = 0;
    const m = mochi('idle', 'md');
    const card = el('div', { class: 'rm-word kana' }, w.w);
    await new Promise((done) => {
      const pics = options.map((o) => {
        const b = el('button', { class: 'rm-pic', 'data-w': o.w }, el('span', { class: 'emoji' }, o.emoji));
        onTap(b, async () => {
          if (b.classList.contains('nope') || pics.some((x) => x.classList.contains('yes'))) return;
          if (o === w) {
            b.classList.add('yes');
            const first = misses === 0;
            [...w.w].forEach((c) => { record(p, c, 'use', first, 0.12); record(p, c, 'read', first, 0.06); });
            if (first) s.correct(); else A.chime(0);
            m.setMood('happy'); m.hop();
            await A.sayVocab(w.id, { lead: 450 });
            await wait(1300);
            done();
          } else {
            misses++;
            if (misses === 1) s.miss();
            b.classList.add('nope');
            A.tok();
            if (misses >= 1) { card.classList.add('hinted'); A.sayVocab(w.id, { lead: 500 }); }
          }
        });
        return b;
      });
      const v = s.view('readmatch',
        el('div', { class: 'rm-left' }, card, el('div', { class: 'rm-mochi' }, m, bubble('Read the word. Which picture is it?'))),
        el('div', { class: 'rm-pics' }, ...pics));
      v.dataset.target = w.w;
    });
  }
}
