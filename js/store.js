// Persistent state: profiles, progress, settings. Everything lives in localStorage.
const KEY = 'hiraganaQuest.v1';

const defaultState = () => ({
  profiles: [],
  settings: { volume: 1, romaji: false, reducedMotion: false, openAll: false, echo: 'fade', townFirst: true },
  lastProfileId: null,
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    return { ...defaultState(), ...s, settings: { ...defaultState().settings, ...(s.settings || {}) } };
  } catch (e) {
    console.warn('Could not load save data', e);
    return defaultState();
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('Could not save', e); }
}

// Ask the browser to keep our data even under storage pressure.
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

export const getState = () => state;
export const settings = () => state.settings;
export function setSetting(k, v) { state.settings[k] = v; save(); }

export const profiles = () => state.profiles;
export const getProfile = (id) => state.profiles.find((p) => p.id === id);

export function createProfile(name, avatar, color) {
  const p = {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim().slice(0, 16) || 'Player',
    avatar, color,
    created: Date.now(),
    chars: {},          // h -> { hear, write, intro, last, seen }
    trophies: {},       // h -> 1 bronze | 2 silver | 3 gold (never goes down)
    rowTrophies: {},    // rowId -> true
    stamps: [],         // { date, chars: [h...] }
    mochiSpeed: 5200,   // karuta: ms before Mochi grabs a card (adapts)
    bestStreak: 0,
  };
  state.profiles.push(p);
  save();
  return p;
}

export function deleteProfile(id) {
  state.profiles = state.profiles.filter((p) => p.id !== id);
  if (state.lastProfileId === id) state.lastProfileId = null;
  save();
}

export function resetProfile(id) {
  const p = getProfile(id);
  if (!p) return;
  Object.assign(p, { chars: {}, trophies: {}, rowTrophies: {}, stamps: [], mochiSpeed: 5200, bestStreak: 0, dojoSel: [], coins: 0, coinProg: 0, owned: [], look: {}, wish: null });
  save();
}

export function setLastProfile(id) { state.lastProfileId = id; save(); }
