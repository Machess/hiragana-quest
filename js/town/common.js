// Shared pieces for Mochi's Town topics (Family, Directions, …): lesson list, lesson runner,
// speech-bubble helpers and per-player topic progress.
import { el, mochi, said, petals, kobanPill } from '../ui.js';
import * as A from '../audio.js';
import * as S from '../store.js';
import { KANA } from '../data.js';
import { Session, ExitError } from '../session.js';
import { addCoins } from '../wardrobe.js';

export const BASIC = new Set(KANA.map((k) => k.h));
export const readableText = (t) => [...t.replace(/[\s。！？、]/g, '')].every((c) => BASIC.has(c));
export const voice = (id) => `audio/voice/${id}.mp3`;
export const quiet = (id, o = {}) => A.play(voice(id), { interrupt: true, ...o });   // one line, no English echo
export const topic = (p, key) => { p.town = p.town || {}; return (p.town[key] = p.town[key] || { done: [] }); };
export const bubbleLine = (id, rest) => el('div', { class: 'bubble town-bubble' }, ...said(id, rest));
export function replayBtn(fn) { const b = el('button', { class: 'icon-btn replay', 'aria-label': 'Hear it again' }, '🔊'); b.onclick = fn; return b; }
export const shake = (n) => { n.classList.remove('shake'); void n.offsetWidth; n.classList.add('shake'); };

// The list of a topic's lessons: done ✓, the next one highlighted, later ones locked.
// def: { key, lessons: [{ id, name, icon, what, fn }], back: (ctx) => void }
export function lessonList(ctx, def) {
  const st = topic(ctx.profile, def.key);
  const next = def.lessons.findIndex((l) => !st.done.includes(l.id));
  return el('div', { class: 'lesson-list' }, ...def.lessons.map((l, i) => {
    const done = st.done.includes(l.id);
    const open = done || i === next || S.settings().openAll;
    const b = el('button', { class: 'lesson' + (done ? ' done' : '') + (i === next ? ' next' : '') + (open ? '' : ' locked'), disabled: !open },
      el('span', { class: 'lesson-icon' }, open ? l.icon : '🔒'),
      el('span', { class: 'lesson-text' }, el('b', {}, `${i + 1}. ${l.name}`), el('small', {}, l.what)),
      el('span', { class: 'lesson-mark' }, done ? '✓' : ''));
    b.onclick = () => runLesson(ctx, def, l);
    return b;
  }));
}

// Plays one lesson inside a Session (top bar, streaks, koban, calm pacing), then a done card.
export async function runLesson(ctx, def, lesson) {
  const p = ctx.profile;
  const st = topic(p, def.key);
  const s = new Session({ profile: p, root: ctx.app, steps: 1, onExit: () => def.back(ctx) });
  try {
    await lesson.fn(s, ctx);
    await s.calm(900);
  } catch (e) {
    if (e instanceof ExitError) return;
    throw e;
  }
  const first = !st.done.includes(lesson.id);
  if (first) st.done.push(lesson.id);
  s.earned(addCoins(p, first ? 3 : 1));
  S.save();
  s.end();
  const i = def.lessons.indexOf(lesson);
  const nextL = def.lessons[i + 1];
  const m = mochi('happy', 'lg');
  const go = A.afterSpeech(el('button', { class: 'btn big' }, 'Next'));
  ctx.screen('town-done',
    el('div', { class: 'check-side' }, m, el('div', { class: 'bubble' }, ...said('yattane',
      nextL ? `Lesson done! Next: ${nextL.name}` : def.allDone))),
    s.coinsEarned ? el('div', { class: 'center' }, 'You earned ', kobanPill(s.coinsEarned)) : null,
    el('div', { class: 'center' }, go));
  A.chime(2); petals(16); m.hop();
  A.say('yattane', { lead: 500 });
  go.onclick = () => def.back(ctx);
}
