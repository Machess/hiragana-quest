// Core games: Meet a new character, Trace, Listen & Pick, Picture Write.
import { el, mochi, wait, speakerIcon, icon, onTap } from '../ui.js';
import * as A from '../audio.js';
import { kana, record, introduce, pickTargets, distractors, shuffle, traceLevel, mastery } from '../learn.js';
import { createTracePad, animatedKanaSVG } from '../trace.js';
import { settings } from '../store.js';
import { guard } from '../session.js';

const HINTS = {
  shape: 'Almost! Watch and try again.',
  direction: 'Start from the red dot!',
  order: 'Oops, a different stroke comes first. Watch!',
  free: 'Nearly! Watch the strokes, then try again.',
};

function bubble(text) {
  return el('div', { class: 'bubble' }, text);
}

// Speaker button that plays a clip.
function speaker(fn, cls = '') {
  const b = el('button', { class: `speaker ${cls}`, 'aria-label': 'Play sound', html: speakerIcon() });
  onTap(b, () => { b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); fn(); });
  return b;
}

// --------------- Meet a new hiragana ---------------
export async function meet(s, h) {
  const p = s.p;
  introduce(p, h);
  const k = kana(h);
  const m = mochi('happy', 'md');
  const big = el('div', { class: 'meet-card', html: animatedKanaSVG(h) });
  const again = () => { big.innerHTML = animatedKanaSVG(h); A.sayKana(h); };
  onTap(big, again);
  const word = el('div', { class: 'meet-word' },
    el('span', { class: 'emoji' }, k.emoji),
    el('span', { class: 'jp' }, ...[...k.word].map((c, i) => el('span', { class: i === k.idx ? 'hl' : '' }, c))),
    settings().romaji ? el('span', { class: 'romaji' }, k.meaning) : null,
  );
  onTap(word, () => A.sayWord(h));
  const go = el('button', { class: 'btn big' }, 'Let’s write it!');
  const v = s.view('meet',
    el('div', { class: 'meet-left' }, m, bubble('A new hiragana!')),
    el('div', { class: 'meet-mid' }, big,
      el('div', { class: 'meet-sound' }, speaker(() => A.sayKana(h), 'lg'),
        settings().romaji ? el('span', { class: 'romaji big' }, k.r) : null)),
    el('div', { class: 'meet-right' }, word, go),
  );
  A.say('atarashii').then(() => wait(250)).then(() => A.sayKana(h));
  setTimeout(() => A.sayWord(h).catch(() => {}), 3200);
  await new Promise((res) => go.addEventListener('click', res, { once: true }));
  guard(s);
  // Trace three times with fading help.
  for (const level of [0, 1, 2]) {
    await traceOne(s, h, level, { title: level === 0 ? 'Trace it' : level === 1 ? 'Again!' : 'One more!', gainScale: 0.6 });
    guard(s);
  }
  void v;
}

// --------------- Trace one character ---------------
async function traceOne(s, h, level, { title, gainScale = 1 } = {}) {
  const p = s.p;
  title = title || ['Trace it', 'Trace it', 'Write it! Start at the dot', 'Write it from memory!'][level];
  const msg = bubble(title);
  const m = mochi('idle', 'md');
  let resolve;
  const finished = new Promise((r) => (resolve = r));
  const pad = createTracePad({
    h, level,
    onStroke: (ok, info) => {
      if (ok) { A.pop(); return; }
      A.tok();
      msg.textContent = HINTS[info.reason] || HINTS.shape;
      m.setMood('idle');
    },
    onDone: (r) => resolve(r),
  });
  const tools = el('div', { class: 'pad-tools' },
    speaker(() => A.sayKana(h)),
    (() => { const b = el('button', { class: 'icon-btn', 'aria-label': 'Show me', html: icon('bulb') }); b.onclick = () => pad.hint(); return b; })(),
    level === 3 ? (() => { const b = el('button', { class: 'icon-btn', 'aria-label': 'Undo', html: icon('undo') }); b.onclick = () => pad.undo(); return b; })() : null,
  );
  s.view('trace', el('div', { class: 'side' }, m, msg), el('div', { class: 'pad-wrap' }, pad.node), tools);
  A.sayKana(h);
  if (level === 0) setTimeout(() => pad.demo(), 500);
  const r = await finished;
  pad.destroy();
  const gain = [0.1, 0.15, 0.22, 0.3][level] * (r.assisted ? 0.4 : 1) * (0.7 + 0.3 * r.quality) * gainScale;
  record(p, h, 'write', true, gain);
  if (r.misses >= 2) s.miss(h); else s.correct(h);
  m.setMood('happy'); m.hop();
  msg.textContent = r.quality > 0.6 && !r.misses ? 'Beautiful!' : 'Well done!';
  if (r.quality > 0.65 && !r.misses) A.say('pittari'); else A.praise();
  await wait(1300);
  return r;
}

export async function trace(s, { pool, boost = [], count = 3 }) {
  // New chars first, then those with the weakest writing.
  const p = s.p;
  const byWrite = [...pool].sort((a, b) => ((p.chars[a] || {}).write || 0) - ((p.chars[b] || {}).write || 0));
  const targets = [...new Set([...boost, ...byWrite])].slice(0, count);
  for (const h of shuffle(targets)) {
    guard(s);
    await traceOne(s, h, traceLevel(p, h));
  }
}

// --------------- Listen & Pick ---------------
export async function listen(s, { pool, boost = [], count = 6 }) {
  const p = s.p;
  const targets = pickTargets(p, pool, count, boost);
  for (const h of targets) {
    guard(s);
    const hear = (p.chars[h] || {}).hear || 0;
    let n = hear < 0.35 ? 2 : hear < 0.65 ? 3 : 4;
    n = Math.min(n, pool.length);
    const options = shuffle([h, ...distractors(h, pool, n - 1, hear > 0.4)]);
    const m = mochi('idle', 'md');
    let firstTry = true;
    const sp = speaker(() => A.sayKana(h), 'xl');
    await new Promise((done) => {
      const tiles = options.map((o) => {
        const t = el('button', { class: 'choice', 'aria-label': 'choice' }, el('span', { class: 'kana' }, o));
        onTap(t, async () => {
          if (t.disabled) return;
          if (o === h) {
            tiles.forEach((x) => (x.disabled = true));
            t.classList.add('yes');
            record(p, h, 'hear', firstTry, 0.2);
            if (firstTry) s.correct(h); else A.chime(0);
            m.setMood('happy'); m.hop();
            await wait(900);
            done();
          } else {
            if (firstTry) { record(p, h, 'hear', false); s.miss(h); }
            firstTry = false;
            t.classList.add('nope');
            t.disabled = true;
            setTimeout(() => A.sayKana(h), 350);
          }
        });
        return t;
      });
      s.view('listen',
        el('div', { class: 'listen-top' }, m, sp, bubble('Which one is it?')),
        el('div', { class: `choices n${options.length}` }, ...tiles)).dataset.target = h;
      setTimeout(() => A.sayKana(h), 350);
    });
  }
}

// --------------- Picture Write ---------------
export async function picwrite(s, { pool, boost = [], count = 3 }) {
  const p = s.p;
  const targets = pickTargets(p, pool, Math.min(count, pool.length), boost.length ? boost : pool.filter((h) => mastery(p, h) < 0.8));
  for (const h of [...new Set(targets)]) {
    guard(s);
    const k = kana(h);
    const w = (p.chars[h] || {}).write || 0;
    const level = w < 0.4 ? 1 : w < 0.65 ? 2 : 3;
    const blank = el('span', { class: 'blank' }, '?');
    const wordRow = el('div', { class: 'pw-word' },
      ...[...k.word].map((c, i) => (i === k.idx ? blank : el('span', {}, c))));
    const msg = bubble('Write the missing sound!');
    let resolve;
    const finished = new Promise((r) => (resolve = r));
    const pad = createTracePad({
      h, level,
      onStroke: (ok, info) => { if (ok) A.pop(); else { A.tok(); msg.textContent = HINTS[info.reason] || HINTS.shape; } },
      onDone: resolve,
    });
    const tools = el('div', { class: 'pad-tools' },
      speaker(() => A.sayWord(h)),
      (() => { const b = el('button', { class: 'icon-btn', 'aria-label': 'Hint', html: icon('bulb') }); b.onclick = () => pad.hint(); return b; })(),
      level === 3 ? (() => { const b = el('button', { class: 'icon-btn', 'aria-label': 'Undo', html: icon('undo') }); b.onclick = () => pad.undo(); return b; })() : null,
    );
    const pic = el('div', { class: 'pw-pic' }, el('span', { class: 'emoji huge' }, k.emoji));
    onTap(pic, () => A.sayWord(h));
    s.view('picwrite', el('div', { class: 'side' }, pic, wordRow, msg), el('div', { class: 'pad-wrap' }, pad.node), tools);
    A.sayWord(h);
    const r = await finished;
    pad.destroy();
    blank.textContent = h;
    blank.classList.add('filled');
    const gain = [0.1, 0.15, 0.22, 0.3][level] * (r.assisted ? 0.4 : 1) * (0.7 + 0.3 * r.quality);
    record(p, h, 'write', true, gain);
    if (r.misses >= 2) s.miss(h); else s.correct(h);
    msg.textContent = `${k.word}!`;
    msg.classList.add('jp');
    await A.sayWord(h);
    await wait(900);
  }
}
