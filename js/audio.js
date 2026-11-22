// Audio: decoded buffers via Web Audio for instant playback, plus small synthesized
// sounds (chime, pop, stamp). Nothing harsh: there is deliberately no "wrong" buzzer.
import { kana } from './learn.js';
import { settings } from './store.js';
import { LINES } from './lines.js';

let ctx = null;
let master = null;
const buffers = new Map();
const loading = new Map();
let current = null; // currently playing speech source

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    ctx = new C();
    master = ctx.createGain();
    // Safety limiter: keeps loud speech + a chime from crackling on small tablet speakers.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    master.connect(limiter).connect(ctx.destination);
  }
  master.gain.value = settings().volume;
  return ctx;
}

// Must be called from a user gesture once (browsers block autoplay otherwise).
export function unlockAudio() {
  const c = ac();
  if (c.state === 'suspended') c.resume();
}

export const kanaUrl = (h) => `audio/kana/${kana(h).r}.mp3`;
export const wordUrl = (h) => `audio/words/${kana(h).r}.mp3`;
export const voiceUrl = (id) => `audio/voice/${id}.mp3`;

export function load(url) {
  if (buffers.has(url)) return Promise.resolve(buffers.get(url));
  if (loading.has(url)) return loading.get(url);
  const pr = fetch(url)
    .then((r) => r.arrayBuffer())
    .then((ab) => new Promise((res, rej) => ac().decodeAudioData(ab, res, rej)))
    .then((buf) => { buffers.set(url, buf); loading.delete(url); return buf; })
    .catch((e) => { loading.delete(url); console.warn('audio', url, e); return null; });
  loading.set(url, pr);
  return pr;
}

export function preloadChars(chars) {
  chars.forEach((h) => { load(kanaUrl(h)); load(wordUrl(h)); });
}

// ---- Speech queue: calm, natural pacing ----
// Clips never overlap or cut each other off. Each clip waits for the one before it to finish,
// plus a natural pause. A tap on a speaker button (interrupt: true) answers immediately.
export const GAP = 650;        // pause between two queued clips (ms)
const LEAD = 250;              // small breath before speech that follows a chime
let queue = [];                // pending { url, gap, resolve }
let playing = false;
let lastEnd = 0;

function startClip(buf) {
  const c = ac();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(master);
  src.start();
  current = src;
  return new Promise((res) => { src.onended = () => { if (current === src) current = null; res(); }; });
}
async function pump() {
  if (playing) return;
  playing = true;
  while (queue.length) {
    const item = queue.shift();
    const urls = item.urls || [item.url];
    const bufs = await Promise.all(urls.map(load));
    const c = ac();
    if (c.state === 'suspended') await c.resume();
    const since = performance.now() - lastEnd;
    const pause = Math.max(item.gap - since, item.lead || 0);
    if (pause > 0) await new Promise((r) => setTimeout(r, pause));
    for (let i = 0; i < bufs.length; i++) {
      if (item.cancelled) break;
      if (i > 0) await new Promise((r) => setTimeout(r, ECHO_GAP));   // short breath before the English
      if (item.cancelled) break;
      if (bufs[i]) await startClip(bufs[i]);
    }
    lastEnd = performance.now();
    item.resolve();
  }
  playing = false;
}

// Play a speech clip. Returns a promise that resolves when it has finished.
// interrupt: stop whatever is speaking and play now (for taps on a speaker button).
export function play(url, { interrupt = false, gap = GAP, lead = 0, urls = null } = {}) {
  if (interrupt) {
    queue.forEach((q) => { q.cancelled = true; q.resolve(); });
    queue = [];
    if (current) { try { current.stop(); } catch (e) {} current = null; }
    lastEnd = 0;
    gap = 0;
  }
  // Never let a backlog build up: keep at most two waiting clips.
  while (queue.length >= 2) { const old = queue.shift(); old.cancelled = true; old.resolve(); }
  return new Promise((resolve) => { queue.push({ url, urls, gap, lead, resolve }); pump(); });
}
export const isSpeaking = () => playing;

export const sayKana = (h, opts) => play(kanaUrl(h), opts);
export const sayWord = (h, opts) => play(wordUrl(h), opts);
export const sayVocab = (id, opts) => play(`audio/vocab/${id}.mp3`, opts);
// Mochi's lines: Japanese, then (while the child is still learning the phrase) the same in
// English with a Japanese accent. Setting 'echo': 'fade' (default) | 'always' | 'off'.
const ECHO_GAP = 380;
let echoProfile = null;
export function setEchoProfile(p) { echoProfile = p; }
function wantsEcho(id) {
  const mode = settings().echo || 'fade';
  if (mode === 'off' || !LINES[id]) return false;
  if (mode === 'always' || !echoProfile) return true;
  const heard = echoProfile.echo || (echoProfile.echo = {});
  const n = (heard[id] = (heard[id] || 0) + 1);
  // The first 8 times always; then now and then; after 24 times only Japanese.
  return n <= 8 || (n <= 24 && Math.random() < 0.25);
}
export function say(id, opts = {}) {
  const urls = wantsEcho(id) ? [voiceUrl(id), `audio/voice/en/${id}.mp3`] : null;
  return play(voiceUrl(id), { ...opts, urls });
}
// What Mochi says, for speech bubbles: { ja, en }.
export const line = (id) => LINES[id] || { ja: '', en: '' };
// A sound the child asked for by tapping: right away.
export const tapKana = (h) => sayKana(h, { interrupt: true });
export const tapWord = (h) => sayWord(h, { interrupt: true });
export const tapVocab = (id) => sayVocab(id, { interrupt: true });

const PRAISE = ['sugoi', 'yattane', 'jouzu', 'iine'];
// Says a random praise and returns its id, so the speech bubble can show the same words.
export function praise() { const id = PRAISE[Math.floor(Math.random() * PRAISE.length)]; say(id, { lead: LEAD }); return id; }

// ---- Synth sounds ----
function tone(freq, start, dur, gain, type = 'sine') {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master);
  o.start(start);
  o.stop(start + dur + 0.05);
}

// Soft bell. level 0 = normal correct, 1 = streak, 2 = big streak
export function chime(level = 0) {
  const c = ac();
  const t = c.currentTime + 0.01;
  const notes = level === 0 ? [1046.5] : level === 1 ? [784, 1046.5, 1318.5] : [784, 1046.5, 1318.5, 1568];
  notes.forEach((f, i) => {
    tone(f, t + i * 0.09, 0.9, 0.12);
    tone(f * 2.01, t + i * 0.09, 0.4, 0.03);
  });
}
export function pop() {
  const c = ac();
  const t = c.currentTime + 0.005;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(520, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.08);
  g.gain.setValueAtTime(0.1, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 0.15);
}
// Gentle wooden "tok" used for a miss. Quiet and neutral.
export function tok() {
  const c = ac();
  const t = c.currentTime + 0.005;
  tone(330, t, 0.12, 0.06, 'triangle');
}
// Soft coin clink for earning a koban.
export function clink() {
  const c = ac();
  const t = c.currentTime + 0.01;
  tone(1975, t, 0.25, 0.05);
  tone(2637, t + 0.07, 0.35, 0.045);
}
export function stampThunk() {
  const c = ac();
  const t = c.currentTime + 0.005;
  const len = 0.18;
  const b = c.createBuffer(1, c.sampleRate * len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
  const s = c.createBufferSource();
  s.buffer = b;
  const f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 400;
  const g = c.createGain(); g.gain.value = 0.5;
  s.connect(f).connect(g).connect(master);
  s.start(t);
  tone(110, t, 0.2, 0.15);
}
export function splash() {
  const c = ac();
  const t = c.currentTime + 0.005;
  const len = 0.35;
  const b = c.createBuffer(1, c.sampleRate * len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2) * 0.5;
  const s = c.createBufferSource(); s.buffer = b;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8;
  const g = c.createGain(); g.gain.value = 0.18;
  s.connect(f).connect(g).connect(master); s.start(t);
}
