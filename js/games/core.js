// Core games: Meet, the writing pad (Trace / Copy / Write), Listen & Pick, Picture Write, Dictation.
import { said, el, mochi, wait, speakerIcon, icon, onTap } from '../ui.js';
import * as A from '../audio.js';
import { kana, record, introduce, pickTargets, distractors, shuffle, writingMode, stepOf, S } from '../learn.js';
import { createTracePad, animatedKanaSVG, kanaSVG } from '../trace.js';
import { settings } from '../store.js';
import { guard, calm } from '../session.js';

const HINTS = {
  shape: 'Almost! Watch and try again.',
  direction: 'Start from the red dot!',
  order: 'Oops, a different stroke comes first. Watch!',
  free: 'Nearly! Watch the strokes, then try again.',
};
const bubble = (text, cls = '') => el('div', { class: `bubble ${cls}` }, text);

// Speaker button: a tap plays right away.
export function speaker(fn, cls = '') {
  const b = el('button', { class: `speaker ${cls}`, 'aria-label': 'Play sound', html: speakerIcon() });
  onTap(b, () => { b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); fn(); });
  return b;
}
function iconButton(name, label, fn) {
  const b = el('button', { class: 'icon-btn', 'aria-label': label, html: icon(name) });
  b.onclick = fn;
  return b;
}

// --------------- Meet a new hiragana ---------------
export async function meet(s, h) {
  const p = s.p;
  introduce(p, h);
  const k = kana(h);
  const m = mochi('happy', 'md');
  const big = el('div', { class: 'meet-card', html: animatedKanaSVG(h, { perStroke: 0.9 }) });
  onTap(big, () => { big.innerHTML = animatedKanaSVG(h, { perStroke: 0.9 }); A.tapKana(h); });
  const word = el('div', { class: 'meet-word' },
    el('span', { class: 'emoji' }, k.emoji),
    el('span', { class: 'jp' }, ...[...k.word].map((c, i) => el('span', { class: i === k.idx ? 'hl' : '' }, c))),
    settings().romaji ? el('span', { class: 'romaji' }, k.meaning) : null,
  );
  onTap(word, () => A.tapWord(h));
  const go = el('button', { class: 'btn big' }, 'Let’s write it!');
  s.view('meet',
    el('div', { class: 'meet-left' }, m, bubble(said('atarashii'))),
    el('div', { class: 'meet-mid' }, big,
      el('div', { class: 'meet-sound' }, speaker(() => A.tapKana(h), 'lg'),
        settings().romaji ? el('span', { class: 'romaji big' }, k.r) : null)),
    el('div', { class: 'meet-right' }, word, go),
  );
  // Calm introduction: "a new hiragana!" … あ … (pause) … あり
  A.say('atarashii');
  A.sayKana(h, { gap: 800 });
  A.sayWord(h, { gap: 1100 });
  A.afterSpeech(go);
  await new Promise((res) => go.addEventListener('click', res, { once: true }));
  await calm(s, 500);
  await writeOne(s, h, { level: 0, mode: 'trace', title: 'Trace it' });
  await calm(s, 700);
  await writeOne(s, h, { level: 1, mode: 'trace', title: 'Again, nice and slow!' });
}

// --------------- The writing pad: Trace / Copy / Write ---------------
// cue: 'kana' (hear the sound), 'word' (picture + word with a blank), 'dictation' (sound only)
export async function writeOne(s, h, { level, mode, title, cue = 'kana' }) {
  const p = s.p;
  const k = kana(h);
  title = title || (mode === 'copy' ? 'Look, then write it yourself!'
    : ['Trace it', 'Trace it', 'Write it! Start at the dot', 'Write it from memory!'][level]);
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
    },
    onDone: (r) => resolve(r),
  });
  const replay = cue === 'word' ? () => A.tapWord(h) : () => A.tapKana(h);
  const tools = el('div', { class: 'pad-tools' },
    speaker(replay),
    iconButton('bulb', 'Show me', () => pad.hint()),
    level === 3 ? iconButton('undo', 'Undo', () => pad.undo()) : null);

  let side;
  let blank = null;
  if (cue === 'word') {
    blank = el('span', { class: 'blank' }, '?');
    const pic = el('div', { class: 'pw-pic' }, el('span', { class: 'emoji huge' }, k.emoji));
    onTap(pic, () => A.tapWord(h));
    side = el('div', { class: 'side' }, pic,
      el('div', { class: 'pw-word' }, ...[...k.word].map((c, i) => (i === k.idx ? blank : el('span', {}, c)))), msg);
  } else if (cue === 'dictation') {
    const ear = el('button', { class: 'dict-ear' }, el('span', { class: 'emoji' }, '👂'), el('span', {}, 'Listen'));
    onTap(ear, () => A.tapKana(h));
    blank = el('span', { class: 'blank big' }, '?');
    side = el('div', { class: 'side' }, ear, blank, msg);
  } else if (mode === 'copy') {
    side = el('div', { class: 'side' }, el('div', { class: 'model-card', html: kanaSVG(h) }), msg);
  } else {
    side = el('div', { class: 'side' }, m, msg);
  }
  const v = s.view(cue === 'kana' ? 'trace' : cue === 'word' ? 'picwrite' : 'dictation', side, el('div', { class: 'pad-wrap' }, pad.node), tools);
  v.dataset.target = h;
  if (cue === 'word') A.sayWord(h, { lead: 400 }); else A.sayKana(h, { lead: 400 });
  if (level === 0) setTimeout(() => pad.demo(), 900);

  const r = await finished;
  pad.destroy();
  const clean = !r.assisted && r.misses < 2;
  const skill = mode === 'copy' ? 'copy' : level === 3 ? 'write' : 'trace';
  record(p, h, skill, clean, [0.1, 0.15, 0.22, 0.3][level]);
  if (clean) s.correct(h); else s.miss(h);
  m.setMood('happy'); m.hop();
  if (blank) { blank.textContent = h; blank.classList.add('filled'); }
  if (cue === 'word') {
    msg.textContent = `${k.word}!`;
    msg.classList.add('jp');
    await A.sayWord(h, { lead: 500 });
  } else {
    // The bubble shows exactly what Mochi says: neat writing gets きれい！ Beautiful!
    let id = !r.misses && r.quality > 0.85 ? 'pittari' : !r.misses && r.quality > 0.6 ? 'kirei' : null;
    if (id) A.say(id, { lead: 400 }); else id = A.praise();
    msg.replaceChildren(...said(id));
  }
  await wait(1700);
  return r;
}

// Trace practice: each character is written the way its path step asks for.
export async function trace(s, { pool, boost = [], only = null, count = 3 }) {
  const p = s.p;
  const cand = only && only.length ? only : pool;
  // Chosen characters (Dojo): all of them, shuffled. Otherwise the least-practised first.
  const order = only && only.length ? shuffle([...cand]) : [...cand].sort((a, b) => stepOf(p, a) - stepOf(p, b));
  const uniq = [...new Set([...boost.filter((h) => cand.includes(h)), ...order])];
  // More rounds than characters: go round the list again (each round uses the mode its
  // path step asks for, so a character moves from tracing to copying as it practises).
  const targets = Array.from({ length: Math.max(1, Math.min(count, only && only.length ? count : uniq.length)) }, (_, i) => uniq[i % uniq.length]);
  for (const h of targets) {
    await calm(s, 700);
    await writeOne(s, h, writingMode(p, h));
  }
}

// --------------- Listen & Pick (hear → find) ---------------
export async function listen(s, { pool, boost = [], only = null, count = 6 }) {
  const p = s.p;
  const targets = pickTargets(p, pool, count, boost, only);
  for (const h of targets) {
    await calm(s, 700);
    const st = stepOf(p, h);
    let n = st <= S.hear ? 2 : st <= S.read ? 3 : 4;
    n = Math.min(n, pool.length);
    const options = shuffle([h, ...distractors(h, pool, n - 1, st > S.hear)]);
    const m = mochi('idle', 'md');
    let firstTry = true;
    const sp = speaker(() => A.tapKana(h), 'xl');
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
            await wait(1400);
            done();
          } else {
            if (firstTry) { record(p, h, 'hear', false); s.miss(h); }
            firstTry = false;
            t.classList.add('nope');
            t.disabled = true;
            A.sayKana(h, { lead: 500 });
          }
        });
        return t;
      });
      s.view('listen',
        el('div', { class: 'listen-top' }, m, sp, bubble('Which one is it?')),
        el('div', { class: `choices n${options.length}` }, ...tiles)).dataset.target = h;
      A.sayKana(h, { lead: 600 });
    });
  }
}

// Characters ready to be written without a guide (passed Copy), weakest first.
function writable(p, pool, only) {
  const cand = only && only.length ? only : pool;
  const ready = cand.filter((h) => stepOf(p, h) > S.copy);
  return ready.length ? ready : cand;
}
const memoryLevel = (p, h) => (stepOf(p, h) >= S.write ? 3 : stepOf(p, h) > S.copy ? 2 : 1);

// --------------- Picture Write (picture + word → write the missing character) ---------------
export async function picwrite(s, { pool, boost = [], only = null, count = 3 }) {
  const p = s.p;
  const cand = writable(p, pool, only);
  const targets = [...new Set(pickTargets(p, cand, Math.min(count, cand.length) + 2, boost, cand))].slice(0, count);
  for (const h of targets) {
    await calm(s, 700);
    await writeOne(s, h, { level: memoryLevel(p, h), mode: 'write', cue: 'word', title: 'Write the missing sound!' });
  }
}

// --------------- Dictation (hear a sound → write it, no picture) ---------------
export async function dictation(s, { pool, boost = [], only = null, count = 3 }) {
  const p = s.p;
  const cand = writable(p, pool, only);
  const targets = [...new Set(pickTargets(p, cand, Math.min(count, cand.length) + 2, boost, cand))].slice(0, count);
  for (const h of targets) {
    await calm(s, 700);
    await writeOne(s, h, { level: memoryLevel(p, h), mode: 'write', cue: 'dictation', title: 'Listen, then write what you hear!' });
  }
}
