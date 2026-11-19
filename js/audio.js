// Audio: decoded buffers via Web Audio for instant playback, plus small synthesized
// sounds (chime, pop, stamp). Nothing harsh: there is deliberately no "wrong" buzzer.
import { kana } from './learn.js';
import { settings } from './store.js';

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

// Play a speech clip. Stops any previous speech so clips never overlap.
export async function play(url, { interrupt = true } = {}) {
  const buf = await load(url);
  if (!buf) return;
  const c = ac();
  if (c.state === 'suspended') await c.resume();
  if (interrupt && current) { try { current.stop(); } catch (e) {} }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(master);
  src.start();
  current = src;
  return new Promise((res) => { src.onended = res; });
}

export const sayKana = (h) => play(kanaUrl(h));
export const sayWord = (h) => play(wordUrl(h));
export const say = (id) => play(voiceUrl(id));

const PRAISE = ['sugoi', 'yattane', 'jouzu', 'iine', 'pittari'];
export const praise = () => say(PRAISE[Math.floor(Math.random() * PRAISE.length)]);

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
