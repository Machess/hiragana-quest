// Keeping the installed app up to date.
// - At start-up: ask GitHub Pages for the newest version. If there is one, download it (only the
//   changed files) behind a calm Mochi screen, then restart into it before the child begins.
// - If the app was already open (Android keeps installed apps in memory), it checks again when it
//   comes back to the front, and applies a new version only on a calm screen (home / players),
//   never in the middle of a game.
// - No internet: the app just starts with the version it has.
import { el, mochi, wait, toast } from './ui.js';

let reg = null;
let applying = false;
let lastCheck = 0;
let progressCb = null;
let onSafeScreen = false;
const RECHECK_MS = 30 * 60 * 1000;

const hasSW = () => 'serviceWorker' in navigator && location.protocol !== 'file:';

export async function initUpdates() {
  if (!hasSW()) return;
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'progress' && progressCb) progressCb(e.data);
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) location.reload(); });
  try {
    reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
  } catch (e) { reg = null; return; }
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    if (!w) return;
    w.addEventListener('statechange', () => {
      // A version found while the app is open waits for a calm moment.
      if (w.state === 'installed' && navigator.serviceWorker.controller && onSafeScreen && !applying) applyNow();
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck > RECHECK_MS) check();
  });
}

async function check() {
  if (!reg) return;
  lastCheck = Date.now();
  try { await reg.update(); } catch (e) { /* offline or server busy: keep the current version */ }
}

// Resolves true once a downloaded version is ready, false if it failed or took too long.
function waitInstalled(ms) {
  return new Promise((resolve) => {
    if (reg.waiting) return resolve(true);
    const w = reg.installing;
    if (!w) return resolve(false);
    const t = setTimeout(() => resolve(!!reg.waiting), ms);
    w.addEventListener('statechange', () => {
      if (w.state === 'installed') { clearTimeout(t); resolve(true); }
      if (w.state === 'redundant') { clearTimeout(t); resolve(false); }
    });
  });
}

// ---- Mochi's update screen ----
let panel = null;
function showPanel(text) {
  if (!panel) {
    const bar = el('div', { class: 'upd-bar' }, el('div', { class: 'upd-fill' }));
    panel = el('div', { class: 'upd-panel' },
      el('div', { class: 'upd-box' }, mochi('happy', 'lg'), el('p', { class: 'upd-text' }), bar));
    (document.getElementById('overlay') || document.body).append(panel);
  }
  panel.querySelector('.upd-text').textContent = text;
  return panel;
}
function setProgress(f) {
  if (panel) panel.querySelector('.upd-fill').style.transform = `scaleX(${Math.max(0.04, Math.min(1, f))})`;
}
function hidePanel() { if (panel) { panel.remove(); panel = null; } }

async function liveNotes() {
  try {
    const r = await fetch(`version.json?live=${Date.now()}`, { cache: 'no-store' });
    return (await r.json()).notes || '';
  } catch (e) { return ''; }
}

// Switch to the downloaded version: the page restarts into it.
export function applyNow() {
  if (!reg || !reg.waiting || applying) return false;
  applying = true;
  showPanel('All set! Starting the new version…');
  setProgress(1);
  try { sessionStorage.setItem('hq-updated', '1'); } catch (e) {}
  setTimeout(() => reg.waiting && reg.waiting.postMessage('apply'), 700);
  setTimeout(() => location.reload(), 5000); // fallback if the switch event never comes
  return true;
}

// At start-up, before the first screen.
export async function startupCheck() {
  if (!reg) return;
  if (reg.waiting && navigator.serviceWorker.controller) { applyNow(); return new Promise(() => {}); }
  if (!navigator.serviceWorker.controller || !navigator.onLine) return; // first run installs itself; offline: just play
  // Only show the "checking" screen if the check isn't instant.
  const slow = setTimeout(() => showPanel('Checking for new things…'), 500);
  await Promise.race([check(), wait(4000)]);
  clearTimeout(slow);
  if (reg.installing || reg.waiting) {
    const notes = await liveNotes();
    showPanel(notes ? `Getting new things: ${notes}` : 'Getting new things…');
    progressCb = (m) => setProgress(m.done / m.total);
    const ok = await waitInstalled(90000);
    progressCb = null;
    if (ok && applyNow()) return new Promise(() => {}); // the page restarts
  }
  hidePanel();
}

// main.js calls this whenever a calm screen (players / home) is shown, and with false otherwise.
export function safeScreen(isSafe) {
  onSafeScreen = isSafe;
  if (!isSafe || !reg) return;
  if (reg.waiting && navigator.serviceWorker.controller) applyNow();
  else if (Date.now() - lastCheck > RECHECK_MS) check();
}

// The version that is running now (served from the device).
export async function currentVersion() {
  try { return await (await fetch('version.json')).json(); } catch (e) { return null; }
}

// Grown-ups screen: "Check for updates".
export async function checkNow() {
  if (!reg) return 'unsupported';
  if (!navigator.onLine) return 'offline';
  await check();
  if (reg.installing || reg.waiting) {
    showPanel('Getting new things…');
    progressCb = (m) => setProgress(m.done / m.total);
    const ok = await waitInstalled(90000);
    progressCb = null;
    if (ok) { applyNow(); return 'updating'; }
    hidePanel();
    return 'failed';
  }
  return 'latest';
}

// After a restart into a new version, say so once.
export async function welcomeNewVersion() {
  let flag = null;
  try { flag = sessionStorage.getItem('hq-updated'); sessionStorage.removeItem('hq-updated'); } catch (e) {}
  if (!flag) return;
  const v = await currentVersion();
  await wait(600);
  toast(el('span', { class: 'step-toast' }, '✨ ', v && v.notes ? `New: ${v.notes}` : 'Updated to the newest version!'), 3200);
}
