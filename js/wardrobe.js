// Mochi's wardrobe and the koban (こばん) economy.
// Children earn koban by learning and spend them on whatever they like. Nothing is random,
// nothing is for sale for real money, and nothing ever expires. Prices are set so a typical
// item takes about 3–5 adventures of saving.
import { save } from './store.js';

// ---------------- Earning ----------------
export const EARN = {
  answersPerKoban: 5, // every 5 right-first-try answers = 1 koban
  adventure: 3,       // finishing an adventure
  step: 1,            // a character climbs a stone on its path
  master: 5,          // a character reaches ⭐
  row: 10,            // a whole row turns gold
};

// One right-first-try answer. Returns the number of koban earned (0 or 1).
export function countAnswer(p) {
  p.coinProg = (p.coinProg || 0) + 1;
  if (p.coinProg < EARN.answersPerKoban) { save(); return 0; }
  p.coinProg -= EARN.answersPerKoban;
  p.coins = (p.coins || 0) + 1;
  save();
  return 1;
}
export function addCoins(p, n) {
  if (!n) return 0;
  p.coins = (p.coins || 0) + n;
  save();
  return n;
}
export const balance = (p) => p.coins || 0;

// ---------------- The catalogue ----------------
// name: shown in hiragana (characters the child hasn't met are dimmed); voice: audio/wardrobe/<id>.mp3
export const CATS = [
  { id: 'color', name: 'Colours', icon: '🎨' },
  { id: 'hat', name: 'Hats', icon: '🎩' },
  { id: 'item', name: 'Items', icon: '🏮' },
  { id: 'reaction', name: 'Reactions', icon: '💃' },
  { id: 'celebration', name: 'Celebrations', icon: '🎉' },
];
export const ITEMS = [
  // Colours: real Japanese sweets
  { id: 'c-sakura', cat: 'color', name: 'さくらもち', en: 'sakura mochi', price: 30 },
  { id: 'c-kusa', cat: 'color', name: 'くさもち', en: 'grass mochi', price: 30 },
  { id: 'c-kinako', cat: 'color', name: 'きなこ', en: 'roasted soy flour', price: 40 },
  { id: 'c-azuki', cat: 'color', name: 'あずき', en: 'red bean', price: 40 },
  { id: 'c-goma', cat: 'color', name: 'ごま', en: 'black sesame', price: 50 },
  { id: 'c-yuzu', cat: 'color', name: 'ゆず', en: 'yuzu citrus', price: 50 },
  // Hats
  { id: 'h-hachimaki', cat: 'hat', name: 'はちまき', en: 'headband', price: 25 },
  { id: 'h-sakura', cat: 'hat', name: 'さくらの かみかざり', en: 'sakura hairpin', price: 30 },
  { id: 'h-flowers', cat: 'hat', name: 'はなかんむり', en: 'flower crown', price: 35 },
  { id: 'h-straw', cat: 'hat', name: 'むぎわらぼうし', en: 'straw hat', price: 45 },
  { id: 'h-knit', cat: 'hat', name: 'けいとの ぼうし', en: 'knitted hat', price: 45 },
  { id: 'h-fox', cat: 'hat', name: 'きつねの おめん', en: 'fox mask', price: 60 },
  { id: 'h-detective', cat: 'hat', name: 'たんていの ぼうし', en: 'detective hat', price: 60 },
  { id: 'h-kabuto', cat: 'hat', name: 'かぶと', en: 'paper samurai helmet', price: 80 },
  // Things to hold
  { id: 'i-onigiri', cat: 'item', name: 'おにぎり', en: 'rice ball', price: 20 },
  { id: 'i-uchiwa', cat: 'item', name: 'うちわ', en: 'paper fan', price: 25 },
  { id: 'i-fude', cat: 'item', name: 'ふで', en: 'writing brush', price: 30 },
  { id: 'i-kasa', cat: 'item', name: 'かさ', en: 'umbrella', price: 40 },
  { id: 'i-chochin', cat: 'item', name: 'ちょうちん', en: 'paper lantern', price: 50 },
  // Reactions (what Mochi does when you get 5 in a row)
  { id: 'r-jump', cat: 'reaction', name: 'ぴょん', en: 'big jump', price: 30 },
  { id: 'r-jiggle', cat: 'reaction', name: 'ぷるぷる', en: 'wobble', price: 30 },
  { id: 'r-spin', cat: 'reaction', name: 'くるりん', en: 'spin', price: 40 },
  { id: 'r-bow', cat: 'reaction', name: 'おじぎ', en: 'bow', price: 40 },
  { id: 'r-wink', cat: 'reaction', name: 'ういんく', en: 'wink', price: 50 },
  { id: 'r-sparkle', cat: 'reaction', name: 'きらきら', en: 'sparkly eyes', price: 60 },
  // Celebrations (what falls from the sky instead of sakura petals)
  { id: 'e-stars', cat: 'celebration', name: 'ほし', en: 'stars', price: 50 },
  { id: 'e-snow', cat: 'celebration', name: 'ゆき', en: 'snowflakes', price: 60 },
  { id: 'e-momiji', cat: 'celebration', name: 'もみじ', en: 'maple leaves', price: 60 },
  { id: 'e-cranes', cat: 'celebration', name: 'おりづる', en: 'paper cranes', price: 90 },
];
export const item = (id) => ITEMS.find((x) => x.id === id);
export const owns = (p, id) => (p.owned || []).includes(id);

export function lookOf(p) { return { color: null, hat: null, item: null, reaction: null, celebration: null, ...(p && p.look) }; }

export function buy(p, id) {
  const it = item(id);
  if (!it || owns(p, id) || balance(p) < it.price) return false;
  p.coins -= it.price;
  p.owned = [...(p.owned || []), id];
  if (p.wish === id) p.wish = null;
  wear(p, id);
  return true;
}
export function wear(p, id) {
  const it = item(id);
  p.look = { ...lookOf(p), [it.cat]: id };
  save();
}
export function takeOff(p, cat) {
  p.look = { ...lookOf(p), [cat]: null };
  save();
}

// ---------------- Drawing: colours ----------------
export const PALETTES = {
  default: { body: '#fffdf8', line: '#e8dccb', ear: '#f6c4cf', cheek: '#f6b7c4' },
  'c-sakura': { body: '#fbd9e1', line: '#eab3c0', ear: '#f19bb0', cheek: '#ef8fa6' },
  'c-kusa': { body: '#c8dca6', line: '#a3bd7e', ear: '#f6c4cf', cheek: '#f4a9b8' },
  'c-kinako': { body: '#f0d9a4', line: '#d4b673', ear: '#f6c4cf', cheek: '#f0a8a0' },
  'c-azuki': { body: '#cfa3a3', line: '#a97a7a', ear: '#f3c1c8', cheek: '#e88d9c' },
  'c-goma': { body: '#a9a9b0', line: '#85858e', ear: '#f3c1cc', cheek: '#f0a3b6' },
  'c-yuzu': { body: '#ffeb99', line: '#e8cd5f', ear: '#f6c4cf', cheek: '#f7a7a0' },
};
export const palette = (look) => PALETTES[(look && look.color) || 'default'] || PALETTES.default;

// ---------------- Drawing: hats (on top of the head; viewBox 0 0 120 120) ----------------
const HATS = {
  'h-hachimaki': `<path d="M27 47 Q60 33 93 47 L95 53 Q60 39 25 53 Z" fill="#e4572e"/>
    <circle cx="60" cy="42" r="3.2" fill="#fff"/>
    <path d="M92 47 L106 42 L103 50 Z M93 51 L106 56 L99 58 Z" fill="#e4572e"/>`,
  'h-sakura': `<g transform="translate(84 42)">${[0, 72, 144, 216, 288].map((a) =>
    `<ellipse cx="0" cy="-5.2" rx="3.6" ry="5" fill="#f7a8bb" transform="rotate(${a})"/>`).join('')}
    <circle r="2.4" fill="#e8b923"/></g>`,
  'h-flowers': `<path d="M30 46 Q60 30 90 46" stroke="#7fb069" stroke-width="3" fill="none"/>
    ${[[33, 45, '#f7a8bb'], [44, 39, '#ffe08a'], [56, 36, '#fff'], [68, 37, '#f7a8bb'], [79, 40, '#9cc8e8'], [88, 45, '#ffe08a']].map(([x, y, c]) =>
      `<g transform="translate(${x} ${y})">${[0, 90, 180, 270].map((a) => `<ellipse cx="0" cy="-3" rx="2.4" ry="3.2" fill="${c}" stroke="#e2d7c1" stroke-width=".6" transform="rotate(${a})"/>`).join('')}<circle r="1.7" fill="#e8b923"/></g>`).join('')}`,
  'h-straw': `<path d="M38 36 C38 14 82 14 82 36 Z" fill="#f0cf7a" stroke="#c9a24a" stroke-width="1.5"/>
    <rect x="38" y="29" width="44" height="6" fill="#e4572e"/>
    <ellipse cx="60" cy="37" rx="46" ry="8.5" fill="#f4d98d" stroke="#c9a24a" stroke-width="1.5"/>
    <path d="M24 37 Q60 45 96 37" stroke="#d9b763" stroke-width="1" fill="none"/>`,
  'h-knit': `<path d="M30 46 C30 16 90 16 90 46 Z" fill="#5b7bd5"/>
    ${[40, 50, 60, 70, 80].map((x) => `<path d="M${x} 22 L${x} 40" stroke="#4a68bd" stroke-width="2"/>`).join('')}
    <rect x="28" y="38" width="64" height="9" rx="4" fill="#8aa4ea"/>
    <circle cx="60" cy="15" r="7" fill="#fff" stroke="#dfe6f7" stroke-width="1.5"/>`,
  'h-fox': `<g transform="rotate(18 86 44)">
    <path d="M72 38 L75 24 L82 33 L90 33 L97 24 L100 38 Q102 54 86 60 Q70 54 72 38 Z" fill="#fff" stroke="#d8cdb8" stroke-width="1.5"/>
    <path d="M76 29 L79 34 M96 29 L93 34" stroke="#e4572e" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M78 43 q4 -3 8 0 M88 43 q4 -3 8 0" stroke="#3b3355" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M80 39 q2 -3 4 0 M90 39 q2 -3 4 0" stroke="#e4572e" stroke-width="1.6" fill="none"/>
    <circle cx="86" cy="53" r="1.8" fill="#3b3355"/></g>`,
  'h-detective': `<path d="M31 46 C31 18 89 18 89 46 Z" fill="#a8825a"/>
    ${[38, 48, 58, 68, 78].map((x) => `<path d="M${x} 24 L${x + 4} 45" stroke="#8c6a46" stroke-width="1.4"/>`).join('')}
    <path d="M34 34 L86 34" stroke="#8c6a46" stroke-width="1.4"/>
    <path d="M44 46 Q60 54 76 46 Z" fill="#8c6a46"/>
    <path d="M60 19 q0 -5 4 -6" stroke="#8c6a46" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  'h-kabuto': `<path d="M24 46 L60 12 L96 46 Z" fill="#3f6fb5" stroke="#2f5590" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M60 12 L60 46" stroke="#2f5590" stroke-width="1.2"/>
    <rect x="22" y="42" width="76" height="8" rx="2" fill="#5b86cc"/>
    <path d="M52 34 L44 14 M68 34 L76 14" stroke="#e8b923" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="60" cy="36" r="3.5" fill="#e8b923"/>`,
};

// ---------------- Drawing: things to hold (at Mochi's right side) ----------------
const HELD = {
  'i-onigiri': `<path d="M95 104 L106 84 L117 104 Z" fill="#fff" stroke="#d8cdb8" stroke-width="2" stroke-linejoin="round"/>
    <rect x="101" y="96" width="10" height="9" rx="1" fill="#2f3b2f"/>`,
  'i-uchiwa': `<path d="M106 86 L102 108" stroke="#c9a24a" stroke-width="3" stroke-linecap="round"/>
    <circle cx="108" cy="74" r="13" fill="#f7a8bb" stroke="#e48aa0" stroke-width="1.5"/>
    ${[-50, -25, 0, 25, 50].map((a) => `<path d="M108 86 L108 62" stroke="#fff" stroke-width=".9" opacity=".7" transform="rotate(${a} 108 86)"/>`).join('')}
    <circle cx="108" cy="72" r="4" fill="#fff" opacity=".8"/>`,
  'i-fude': `<path d="M99 108 L113 72" stroke="#a8642f" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M113 72 L116 62 Q117 58 114 60 L110 70 Z" fill="#2b2b3a"/>`,
  'i-kasa': `<path d="M100 104 L112 42" stroke="#a8642f" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M90 44 Q112 16 134 44 Z" fill="#e4572e" stroke="#b8401f" stroke-width="1.5"/>
    ${[96, 104, 112, 120, 128].map((x) => `<path d="M112 24 L${x} 44" stroke="#f3a07f" stroke-width="1"/>`).join('')}`,
  'i-chochin': `<path d="M98 98 L114 70" stroke="#a8642f" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M114 70 L114 74" stroke="#3b3355" stroke-width="1.5"/>
    <rect x="109" y="74" width="10" height="3" rx="1" fill="#3b3355"/>
    <ellipse cx="114" cy="86" rx="9" ry="10.5" fill="#e4572e"/>
    ${[80, 85, 90].map((y) => `<path d="M105.5 ${y} Q114 ${y + 2} 122.5 ${y}" stroke="#b8401f" stroke-width="1" fill="none"/>`).join('')}
    <rect x="109" y="95" width="10" height="3" rx="1" fill="#3b3355"/>`,
};

export const hatLayer = (look) => (look && look.hat && HATS[look.hat]) || '';
export const heldLayer = (look) => (look && look.item && HELD[look.item]) || '';
export const reactionOf = (look) => (look && look.reaction) || 'r-hop';
export const celebrationOf = (look) => (look && look.celebration) || 'e-sakura';
