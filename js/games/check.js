// Level check (レベル チェック): a short, calm quiz at the end of a level.
// Passed (at most 1 slip, or 2 in a row finale) = the pair moves up a level and gets its trophy.
// Not passed = no fuss: a little more practice, and the check comes back next adventure.
import { el, mochi, wait, said, petals, trophySVG } from '../ui.js';
import * as A from '../audio.js';
import { UNITS, LEVELS, rowUnits, introduced, reviewChars, levelReady, levelUp, unitLevel } from '../learn.js';
import { listen, trace, dictation } from './core.js';
import { detective } from './more.js';
import { guard } from '../session.js';
import { addCoins, EARN } from '../wardrobe.js';

function card(s, cls, ...children) {
  const next = el('button', { class: 'btn big' }, cls === 'start' ? 'Start!' : 'Next');
  s.view(`check-card ${cls}`, ...children, el('div', { class: 'center' }, next));
  return new Promise((r) => next.addEventListener('click', r, { once: true }));
}

// Is a check due now? (The level's practice is done but the level isn't passed yet.)
export const checkDue = (p, unitId, level) => {
  const u = UNITS.find((x) => x.id === unitId);
  return !!u && unitLevel(p, u) < level && levelReady(p, u, level);
};

export async function levelCheck(s, { unitId, level }) {
  const p = s.p;
  const u = UNITS.find((x) => x.id === unitId);
  if (!checkDue(p, unitId, level)) return { done: false };
  const finale = level === 3 && u.last;
  const known = introduced(p);
  const rowChars = rowUnits(u.row).flatMap((x) => x.chars).filter((h) => known.includes(h));
  const earlier = known.filter((h) => !rowChars.includes(h));
  const near = rowChars.length >= 2 ? rowChars : known;            // distractors: the row so far
  const review = reviewChars(p, known.filter((h) => !u.chars.includes(h)), 2);

  // What the check asks, by level. Every part uses the level's own kind of question.
  const parts = level === 1
    ? [[listen, { pool: u.chars.length > 1 ? u.chars : near, only: u.chars, count: 3 }],
       [trace, { pool: u.chars, only: u.chars, count: u.chars.length }]]
    : level === 2
      ? [[detective, { pool: near, only: u.chars, count: 3 }],
         [listen, { pool: near, only: u.chars, count: 3 }]]
      : finale
        ? [[listen, { pool: known, only: rowChars, count: Math.min(5, rowChars.length) }],
           [dictation, { pool: rowChars, only: reviewChars(p, rowChars, 2), count: 2 }],
           ...(earlier.length ? [[detective, { pool: known, only: reviewChars(p, earlier, 2), count: 2 }]] : [])]
        : [[dictation, { pool: u.chars, only: u.chars, count: 2 }],
           [detective, { pool: known.length >= 3 ? known : near, only: [...u.chars, ...review], count: u.chars.length + review.length }]];
  const allowed = finale ? 2 : 1;

  // Start card
  const big = el('div', { class: 'check-kana kana' }, ...u.chars.map((h) => el('span', {}, h)));
  const title = finale ? `Row challenge: the whole ${rowUnits(u.row)[0].chars[0]} row!` : `Level ${level} check · ${LEVELS[level].name}`;
  const startMochi = mochi('happy', 'md');
  const start = card(s, 'start', el('h2', {}, '⭐ ', title), big,
    el('div', { class: 'check-side' }, startMochi, el('div', { class: 'bubble' }, finale ? 'Show Mochi the whole row! A slip or two is OK.' : 'Show Mochi what you know! One slip is OK.')));
  A.chime(1);
  await start;
  guard(s);

  const missBefore = s.missCount;
  for (const [game, o] of parts) {
    guard(s);
    await game(s, { boost: [], ...o });
  }
  guard(s);
  const slips = s.missCount - missBefore;
  const passed = slips <= allowed;

  if (passed) {
    const lv = levelUp(p, u);
    s.levelsUp = (s.levelsUp || 0) + 1;
    s.earned(addCoins(p, EARN.level));
    const trophies = el('div', { class: 'check-trophies' }, ...u.chars.map((h) => el('div', { class: 'cer-item', html: trophySVG(h, lv) })));
    const m = mochi('happy', 'lg');
    const done = card(s, 'pass', el('h2', {}, finale ? 'Row complete! 🏮' : `Level ${lv} done! ${LEVELS[lv].medal}`), trophies,
      el('div', { class: 'check-side' }, m, el('div', { class: 'bubble' }, ...said('yattane', lv < 3 ? `Next: Level ${lv + 1} · ${LEVELS[lv + 1].name}` : 'This pair is gold!'))));
    A.chime(2); petals(18);
    A.say('yattane', { lead: 500 });
    m.hop();
    await done;
  } else {
    const done = card(s, 'again', el('h2', {}, 'Almost!'),
      el('div', { class: 'check-side' }, mochi('idle', 'lg'), el('div', { class: 'bubble' }, ...said('mouikkai', 'A little more practice, and we’ll try again next time.'))));
    A.say('mouikkai', { lead: 400 });
    await done;
  }
  await wait(200);
  return { done: true, passed, slips };
}
