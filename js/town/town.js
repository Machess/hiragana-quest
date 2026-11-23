// Mochi's Town (もちの まち): vocabulary, after all 46 hiragana are gold.
// Each building is a topic; the Family house (かぞく) is the first. Lessons go from words to
// short sentences: meet → who is it (hear) → name tags (read) → build the tree → "this is my …"
// → my own family. Words that need marks the child hasn't learned (じ, ば, ぞ) stay listen-only.
import { el, mochi, wait, said, petals, kobanPill } from '../ui.js';
import * as A from '../audio.js';
import * as S from '../store.js';
import { currentUnit, record, shuffle } from '../learn.js';
import { balance } from '../wardrobe.js';
import { memberSVG, townSVG } from './art.js';
import { BASIC, quiet, topic, bubbleLine, replayBtn, shake, lessonList } from './common.js';
import { showStreets } from './directions.js';

const ROLES = ['ojiisan', 'obaasan', 'otousan', 'okaasan', 'oniisan', 'oneesan', 'watashi', 'otouto', 'imouto'];
const word = (role) => A.line(`f_${role}`);
const readable = (role) => [...word(role).ja].every((c) => BASIC.has(c));
const sayWord = (role, o) => A.say(`f_${role}`, o);

// ---------------- Opening rules ----------------
export const townOpen = (p) => S.settings().openAll || !currentUnit(p);
const isToday = (t) => new Date(t).toDateString() === new Date().toDateString();
export const adventureDoneToday = (p) => (p.stamps || []).some((s) => isToday(s.date));
export const townReadyNow = (p) => townOpen(p) && (S.settings().townFirst === false || S.settings().openAll || adventureDoneToday(p));
const fam = (p) => topic(p, 'family');

// ---------------- Town map ----------------
// ctx: { profile, screen, backBtn, showHome }
export function showTown(ctx) {
  const p = ctx.profile;
  ctx.showTown = () => showTown(ctx);
  const m = mochi('happy', 'md');
  const spot = (cls, label, sub, open, fn) => {
    const b = el('button', { class: `town-spot ${cls}` + (open ? '' : ' closed') }, el('span', { class: 'spot-name' }, label), el('span', { class: 'spot-sub' }, sub));
    b.onclick = open ? fn : () => { A.tok(); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); };
    return b;
  };
  ctx.screen('town',
    el('div', { class: 'topline' }, ctx.backBtn(ctx.showHome, 'Home'), el('h2', {}, 'Mochi’s Town ', el('span', { class: 'kana' }, 'まち')),
      kobanPill(balance(p))),
    el('div', { class: 'town-map' },
      el('div', { class: 'town-art', html: townSVG({ directions: true, food: false }) }),
      spot('s-house', 'Mochi’s house', 'かぞく · family', true, () => showFamily(ctx)),
      spot('s-streets', 'The streets', 'みち · directions', true, () => showStreets(ctx)),
      spot('s-food', 'Food shop', 'たべもの · coming soon', false),
      el('div', { class: 'town-mochi' }, m, el('div', { class: 'bubble' }, ...said('fi_machi')))));
  A.say('fi_machi', { lead: 400 });
}

// ---------------- Family tree drawing ----------------
// rows: [[{ key, role }]] → a tree with one node per member.
function tree(rows, { look, labels = {}, small = false, compact = false } = {}) {
  const nodes = {};
  const most = Math.max(...rows.map((r) => r.length));
  const w = Math.min(small ? 110 : compact ? 128 : 150, Math.floor((small ? 640 : 1120) / most));
  const root = el('div', { class: 'family-tree' + (small ? ' small' : '') + (compact ? ' compact' : ''), style: { '--w': `${w}px` } },
    el('div', { class: 'tree-bg', html: '<svg viewBox="0 0 400 300" preserveAspectRatio="none"><path d="M200 300 V262" stroke="#c9a57a" stroke-width="26" fill="none" stroke-linecap="round"/><ellipse cx="200" cy="138" rx="198" ry="132" fill="#e3f0d3"/></svg>' }),
    ...rows.map((r) => el('div', { class: 'tree-row' }, ...r.map(({ key, role }) => {
      const label = el('div', { class: 'member-label' });
      const pic = el('div', { class: 'member-pic', html: memberSVG(role, 'idle', look) });
      const n = el('button', { class: 'member', 'data-key': key, 'data-role': role }, pic, label);
      nodes[key] = { el: n, role, pic, label,
        show(text = true) { label.replaceChildren(el('span', { class: 'kana' }, word(role).ja), text ? el('small', {}, word(role).en) : ''); label.classList.add('on'); },
        hide() { label.classList.remove('on'); label.replaceChildren(); },
        mood(md) { pic.innerHTML = memberSVG(role, md, look); },
      };
      if (labels[key]) nodes[key].show();
      return n;
    }))));
  return { root, nodes };
}
const MOCHI_FAMILY = [[{ key: 'ojiisan', role: 'ojiisan' }, { key: 'obaasan', role: 'obaasan' }],
  [{ key: 'otousan', role: 'otousan' }, { key: 'okaasan', role: 'okaasan' }],
  [{ key: 'oniisan', role: 'oniisan' }, { key: 'oneesan', role: 'oneesan' }, { key: 'watashi', role: 'watashi' }, { key: 'otouto', role: 'otouto' }, { key: 'imouto', role: 'imouto' }]];

// Resolves with the node the child taps (only among `keys`).
function tapNode(t, keys) {
  return new Promise((res) => {
    const handlers = [];
    keys.forEach((k) => {
      const n = t.nodes[k].el;
      const h = () => { handlers.forEach(([nn, hh]) => nn.removeEventListener('click', hh)); res(t.nodes[k]); };
      handlers.push([n, h]); n.addEventListener('click', h);
    });
  });
}
const FAMILY_DEF = { key: 'family', back: (ctx) => showFamily(ctx), allDone: 'All family lessons done! Mochi’s house is yours.' };
const happy = async (node) => { node.mood('happy'); node.el.classList.add('hop'); await wait(900); node.el.classList.remove('hop'); node.mood('idle'); };
const readCredit = (p, role) => [...word(role).ja].forEach((h) => BASIC.has(h) && record(p, h, 'use', true, 0.05));

// ---------------- The lessons ----------------
const LESSONS = [
  { id: 'meet', name: 'Meet Mochi’s family', icon: '👋', what: 'Tap each one to hear who they are', fn: lessonMeet },
  { id: 'who', name: 'Who is it?', icon: '👂', what: 'Hear a word, tap the right one', fn: lessonWho },
  { id: 'names', name: 'Name tags', icon: '🏷️', what: 'Read the name', fn: lessonNames },
  { id: 'tree', name: 'Build the tree', icon: '🌳', what: 'Put every name in its place', fn: lessonTree },
  { id: 'say', name: 'This is my …', icon: '💬', what: 'Short sentences: hear them, then build them', fn: lessonSay },
  { id: 'mine', name: 'My family', icon: '🏠', what: 'Make your own family tree', fn: lessonMine },
];

// 1 · Meet: one by one, tap the glowing family member to hear who it is.
async function lessonMeet(s) {
  const t = tree(MOCHI_FAMILY, { look: s.p.look });
  const bub = bubbleLine('fi_family');
  s.view('town-lesson', bub, t.root);
  A.say('fi_family', { lead: 400 });
  for (const role of ['ojiisan', 'obaasan', 'otousan', 'okaasan', 'oniisan', 'oneesan', 'otouto', 'imouto', 'watashi']) {
    await s.calm(500);
    const n = t.nodes[role];
    n.el.classList.add('glow');
    await tapNode(t, [role]);
    n.el.classList.remove('glow');
    n.show();
    bub.replaceChildren(...said(`f_${role}`));
    sayWord(role, { interrupt: true });
    s.practise();
    await happy(n);
  }
  await s.calm(600);
  bub.replaceChildren(...said('f_kazoku', 'かぞく = family: everyone together!'));
  A.say('f_kazoku');
}

// 2 · Who is it? Hear a word, tap the right family member. No written names yet.
async function lessonWho(s) {
  const t = tree(MOCHI_FAMILY, { look: s.p.look });
  let target = null;
  const bub = bubbleLine('fi_dare');
  const v = s.view('town-lesson', el('div', { class: 'town-top' }, bub, replayBtn(() => target && quiet(`f_${target}`))), t.root);
  for (const role of shuffle([...ROLES])) {
    await s.calm(700);
    target = role;
    v.dataset.target = role;
    bub.replaceChildren(...said('fi_dare'));
    quiet(`f_${role}`);
    let first = true;
    for (;;) {
      const n = await tapNode(t, ROLES);
      if (n.role === role) {
        if (first) s.correct(null); else A.chime(0);
        n.show(); bub.replaceChildren(...said(`f_${role}`));
        sayWord(role);
        await happy(n);
        await s.calm(500);
        n.hide();
        break;
      }
      if (first) s.miss(null);
      first = false;
      shake(n.el);
      await quiet(`f_${n.role}`);           // "that's おにいさん" …
      await wait(500);
      quiet(`f_${role}`);                   // … and the word again
    }
  }
}

// 3 · Name tags: a family member glows; pick their name from three written words.
async function lessonNames(s) {
  const t = tree(MOCHI_FAMILY, { look: s.p.look, compact: true });
  const tray = el('div', { class: 'word-tray' });
  const bub = bubbleLine('fi_namae');
  const v = s.view('town-lesson', bub, t.root, tray);
  A.say('fi_namae', { lead: 400 });
  const pool = ROLES.filter(readable);
  // Grandparents' names need marks (じ, ば) not learned yet: they keep their spoken tags.
  ROLES.filter((r) => !readable(r)).forEach((r) => t.nodes[r].show());
  for (const role of shuffle([...pool])) {
    await s.calm(700);
    const n = t.nodes[role];
    n.el.classList.add('glow');
    v.dataset.target = role;
    bub.replaceChildren(...said('fi_namae'));
    // Two others, preferring look-alike words (おとうさん / おとうと, おにいさん / おねえさん).
    const near = { otousan: 'otouto', otouto: 'otousan', oniisan: 'oneesan', oneesan: 'oniisan', okaasan: 'otousan', imouto: 'otouto', watashi: 'imouto' };
    const others = shuffle(pool.filter((r) => r !== role && r !== near[role])).slice(0, 1);
    const opts = shuffle([role, near[role], ...others].filter(Boolean)).slice(0, 3);
    let first = true;
    await new Promise((done) => {
      tray.replaceChildren(...opts.map((r) => {
        const c = el('button', { class: 'word-card kana', 'data-role': r }, word(r).ja);
        c.onclick = async () => {
          if (c.disabled) return;
          if (r === role) {
            tray.querySelectorAll('button').forEach((b) => { b.disabled = true; });
            c.classList.add('right');
            if (first) { s.correct(null); readCredit(s.p, role); } else A.chime(0);
            n.el.classList.remove('glow'); n.show();
            bub.replaceChildren(...said(`f_${role}`));
            sayWord(role);
            await happy(n);
            done();
          } else {
            if (first) s.miss(null);
            first = false;
            c.disabled = true; c.classList.add('wrong');
            quiet(`f_${r}`);                // hear what that card says
          }
        };
        return c;
      }));
    });
    tray.replaceChildren();
  }
}

// 4 · Build the tree: tap a name card, then the family member it belongs to.
async function lessonTree(s) {
  const t = tree(MOCHI_FAMILY, { look: s.p.look, compact: true });
  const tray = el('div', { class: 'word-tray tight' });
  const bub = bubbleLine('fi_tsukurou');
  s.view('town-lesson', bub, t.root, tray);
  A.say('fi_tsukurou', { lead: 400 });
  ROLES.filter((r) => !readable(r)).forEach((r) => t.nodes[r].show());
  const todo = ROLES.filter(readable);
  todo.forEach((r) => t.nodes[r].label.classList.add('slot'));
  let picked = null;
  const misses = new Set();
  const cards = shuffle([...todo]).map((r) => {
    const c = el('button', { class: 'word-card kana', 'data-role': r }, word(r).ja);
    c.onclick = () => {
      if (c.classList.contains('placed')) return;
      tray.querySelectorAll('.word-card').forEach((b) => b.classList.remove('picked'));
      picked = picked === r ? null : r;
      if (picked) c.classList.add('picked');
      A.tok();
    };
    return c;
  });
  tray.replaceChildren(...cards);
  await new Promise((finished) => {
    let left = todo.length;
    todo.forEach((role) => t.nodes[role].el.addEventListener('click', async () => {
      const n = t.nodes[role];
      if (!picked || n.label.classList.contains('on')) { if (!picked) cards.forEach((c) => !c.classList.contains('placed') && shake(c)); return; }
      const card = cards.find((c) => c.dataset.role === picked);
      if (picked === role) {
        if (!misses.has(role)) { s.correct(null); readCredit(s.p, role); } else A.chime(0);
        card.classList.remove('picked'); card.classList.add('placed'); card.disabled = true;
        picked = null;
        n.label.classList.remove('slot'); n.show();
        sayWord(role, { interrupt: true });
        happy(n);
        if (--left === 0) finished();
      } else {
        if (!misses.has(picked)) s.miss(null);
        misses.add(picked);
        shake(n.el); shake(card);
        quiet(`f_${picked}`);
        card.classList.remove('picked');      // the card goes back to the tray
        picked = null;
      }
    }));
  });
  await s.calm(600);
  bub.replaceChildren(...said('fi_family'));
  A.say('fi_family');
}

// 5 · This is my …: hear a sentence and tap who it is about; then build sentences from tiles.
async function lessonSay(s) {
  const t = tree(MOCHI_FAMILY, { look: s.p.look, compact: true }, {});
  ROLES.forEach((r) => t.nodes[r].show(false));
  let replay = null;
  const bub = bubbleLine('fi_kiite');
  const line = el('div', { class: 'sentence-line' });
  const tray = el('div', { class: 'word-tray' });
  const v = s.view('town-lesson', el('div', { class: 'town-top' }, bub, replayBtn(() => replay && replay())), t.root, line, tray);
  // Part A: listening, 4 sentences.
  for (const role of shuffle([...ROLES]).slice(0, 4)) {
    await s.calm(700);
    bub.replaceChildren(...said('fi_kiite'));
    v.dataset.target = role;
    replay = () => quiet(`fs_${role}`);
    replay();
    let first = true;
    for (;;) {
      const n = await tapNode(t, ROLES);
      if (n.role === role) {
        if (first) s.correct(null); else A.chime(0);
        bub.replaceChildren(...said(`fs_${role}`));
        A.say(`fs_${role}`);
        await happy(n);
        break;
      }
      if (first) s.miss(null);
      first = false;
      shake(n.el);
      await wait(400);
      replay();
    }
  }
  // Part B: build it, 4 sentences (only names the child can read).
  for (const role of shuffle(ROLES.filter(readable)).slice(0, 4)) {
    await s.calm(800);
    const n = t.nodes[role];
    n.el.classList.add('glow');
    bub.replaceChildren(...said('fi_narabete'));
    const parts = role === 'watashi'
      ? [['これは', 'fc_kore'], ['わたし', 'f_watashi'], ['です', 'fc_desu']]
      : [['これは', 'fc_kore'], ['わたしの', 'fc_watashino'], [word(role).ja, `f_${role}`], ['です', 'fc_desu']];
    replay = null;
    delete v.dataset.target;
    line.replaceChildren(...parts.map(() => el('span', { class: 'gap' })));
    let at = 0, first = true;
    await new Promise((done) => {
      tray.replaceChildren(...shuffle(parts.map((pt, i) => [pt, i])).map(([[text, id], i]) => {
        const c = el('button', { class: 'word-card kana tile', 'data-i': i }, text);
        c.onclick = async () => {
          if (c.disabled) return;
          if (i === at) {
            c.disabled = true; c.classList.add('placed');
            line.children[at].replaceChildren(text); line.children[at].classList.add('on');
            quiet(id);
            if (++at === parts.length) {
              if (first) { s.correct(null); readCredit(s.p, role); } else A.chime(0);
              await A.idle(); await wait(400);
              n.el.classList.remove('glow');
              bub.replaceChildren(...said(`fs_${role}`));
              A.say(`fs_${role}`);
              await happy(n);
              done();
            }
          } else {
            if (first) s.miss(null);
            first = false;
            A.tok(); shake(c);
          }
        };
        return c;
      }));
    });
    await s.calm(600);
    tray.replaceChildren(); line.replaceChildren();
  }
}

// 6 · My family: the child builds their own family, then Mochi tells it back.
const MINE = [['ojiisan', 2], ['obaasan', 2], ['otousan', 2], ['okaasan', 2], ['oniisan', 3], ['oneesan', 3], ['otouto', 3], ['imouto', 3]];
function myRows(counts) {
  const rep = (role) => Array.from({ length: counts[role] || 0 }, (_, i) => ({ key: `${role}${i}`, role }));
  return [[...rep('ojiisan'), ...rep('obaasan')], [...rep('otousan'), ...rep('okaasan')],
    [...rep('oniisan'), ...rep('oneesan'), { key: 'watashi', role: 'watashi' }, ...rep('otouto'), ...rep('imouto')]].filter((r) => r.length);
}
const familySize = (counts) => 1 + MINE.reduce((a, [r]) => a + (counts[r] || 0), 0);

async function lessonMine(s) {
  const f = fam(s.p);
  const counts = { ...(f.my || { otousan: 1, okaasan: 1 }) };
  const preview = el('div', { class: 'mine-preview' });
  const bub = bubbleLine('fi_anata', 'Who is in your family? Use + and −.');
  const steppers = el('div', { class: 'mine-steppers' });
  const ok = el('button', { class: 'btn big' }, 'Done!');
  const draw = () => {
    preview.replaceChildren(tree(myRows(counts), { look: s.p.look, small: true }).root);
    steppers.replaceChildren(...MINE.map(([role, max]) => {
      const n = counts[role] || 0;
      const minus = el('button', { class: 'step-btn', disabled: n === 0 }, '−');
      const plus = el('button', { class: 'step-btn', disabled: n >= max || familySize(counts) >= 13 }, '+');
      minus.onclick = () => { counts[role] = n - 1; A.tok(); draw(); };
      plus.onclick = () => { counts[role] = n + 1; quiet(`f_${role}`); draw(); };
      return el('div', { class: 'mine-row' + (n ? ' on' : '') },
        el('div', { class: 'mine-pic', html: memberSVG(role) }),
        el('div', { class: 'mine-name' }, el('span', { class: 'kana' }, word(role).ja), el('small', {}, word(role).en)),
        minus, el('span', { class: 'mine-n' }, String(n)), plus);
    }));
  };
  draw();
  s.view('town-lesson mine', bub, el('div', { class: 'mine-body' }, steppers, el('div', { class: 'mine-right' }, preview, A.afterSpeech(ok))));
  A.say('fi_anata', { lead: 400 });
  await new Promise((r) => ok.addEventListener('click', r, { once: true }));
  f.my = Object.fromEntries(MINE.map(([r]) => [r, counts[r] || 0]));
  S.save();
  await s.calm(400);
  await presentFamily(s.p, (cls, ...kids) => s.view(cls, ...kids));
  s.practise();
}

// Mochi tells the child's family back: "これは わたしの おとうさん です" … "わたしの かぞくは よにん です".
export async function presentFamily(p, show) {
  const counts = fam(p).my || {};
  const t = tree(myRows(counts), { look: p.look });
  const bub = bubbleLine('fi_family', 'Your family!');
  show('town-lesson', bub, t.root);
  const order = ['ojiisan', 'obaasan', 'otousan', 'okaasan', 'oniisan', 'oneesan', 'watashi', 'otouto', 'imouto'];
  for (const role of order) {
    const keys = Object.keys(t.nodes).filter((k) => t.nodes[k].role === role);
    if (!keys.length) continue;
    await A.idle(); await wait(500);
    keys.forEach((k) => { t.nodes[k].el.classList.add('glow'); t.nodes[k].show(); });
    bub.replaceChildren(...said(`fs_${role}`));
    A.say(`fs_${role}`);
    await A.idle();
    keys.forEach((k) => t.nodes[k].el.classList.remove('glow'));
  }
  await wait(500);
  const n = Math.min(13, familySize(counts));
  bub.replaceChildren(...said(`fn_${n}`));
  A.say(`fn_${n}`);
  petals(14);
  await A.idle();
  await wait(800);
}

// ---------------- The Family house ----------------
export function showFamily(ctx) {
  const p = ctx.profile;
  const f = fam(p);
  const t = tree(MOCHI_FAMILY, { look: p.look, small: true, labels: f.done.includes('meet') ? Object.fromEntries(ROLES.map((r) => [r, 1])) : {} });
  const list = lessonList(ctx, { ...FAMILY_DEF, lessons: LESSONS });
  const mine = f.my ? el('button', { class: 'btn soft' }, '🏠 Show my family') : null;
  if (mine) mine.onclick = async () => {
    const back = el('button', { class: 'btn big' }, 'Back');
    await presentFamily(p, (cls, ...kids) => ctx.screen(`town-show ${cls}`, el('div', { class: 'topline' }, ctx.backBtn(() => showFamily(ctx))), ...kids));
    ctx.screen('town-show', el('div', { class: 'topline' }, ctx.backBtn(() => showFamily(ctx))), tree(myRows(f.my), { look: p.look }).root, el('div', { class: 'center' }, back));
    back.onclick = () => showFamily(ctx);
  };
  ctx.screen('town-family',
    el('div', { class: 'topline' }, ctx.backBtn(() => showTown(ctx), 'Town'), el('h2', {}, 'Mochi’s house ', el('span', { class: 'kana' }, 'かぞく'))),
    el('div', { class: 'family-body' }, el('div', { class: 'family-left' }, t.root, mine), list));
}
