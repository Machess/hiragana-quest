// Mochi's Town artwork: Mochi's family (all invented mochi, same family shape) and the town map.
import { mochiSVG } from '../ui.js';

const INK = '#3b3355';
// Each family member: colours, size (children are smaller) and a few details that tell them apart.
export const MEMBERS = {
  otousan: { body: '#e3ecf8', line: '#9fb3d1', ear: '#f3c6cf', cheek: '#f1b3c0', scale: 1.0 },
  okaasan: { body: '#fde6ec', line: '#e9b5c3', ear: '#f5a9bb', cheek: '#f193a9', scale: 0.98 },
  oniisan: { body: '#e2f1dc', line: '#a9c99c', ear: '#f3c6cf', cheek: '#f1b3c0', scale: 0.86 },
  oneesan: { body: '#ede6f8', line: '#bfb0dc', ear: '#f3c0d2', cheek: '#f0a9c0', scale: 0.86 },
  otouto: { body: '#fff2c9', line: '#e3cf8e', ear: '#f6c4cf', cheek: '#f4a9b8', scale: 0.7 },
  imouto: { body: '#ffe6d5', line: '#efc0a2', ear: '#f6b9c8', cheek: '#f2a0b4', scale: 0.7 },
  ojiisan: { body: '#efe8dc', line: '#cdbfa6', ear: '#efc5c9', cheek: '#ecb2bb', scale: 0.95 },
  obaasan: { body: '#f3e5f1', line: '#d3b7cf', ear: '#f1bfd0', cheek: '#eeabc1', scale: 0.93 },
};

function face(mood) {
  const eyes = mood === 'happy'
    ? `<path d="M38 60 q6 -8 12 0 M70 60 q6 -8 12 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="44" cy="58" rx="4.6" ry="6" fill="${INK}"/><ellipse cx="76" cy="58" rx="4.6" ry="6" fill="${INK}"/><circle cx="45.6" cy="55.6" r="1.6" fill="#fff"/><circle cx="77.6" cy="55.6" r="1.6" fill="#fff"/>`;
  const mouth = mood === 'happy'
    ? '<path d="M53 70 q7 9 14 0 z" fill="#c8506a"/>'
    : `<path d="M54 70 q6 5 12 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return eyes + mouth;
}

// Details drawn on top, per member.
const EXTRA = {
  otousan: () => `
    <g fill="none" stroke="${INK}" stroke-width="2.6"><circle cx="44" cy="58" r="10"/><circle cx="76" cy="58" r="10"/><path d="M54 57 h12"/></g>
    <path d="M60 86 l-6 6 l6 16 l6 -16 z" fill="#4a7bd0"/><path d="M55 84 h10 l-2 4 h-6 z" fill="#3b63ad"/>`,
  okaasan: () => `
    <g transform="translate(86 40)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-7" rx="5" ry="7" fill="#f08fa8" transform="rotate(${a})"/>`).join('')}<circle r="4" fill="#ffd166"/></g>`,
  oniisan: () => `
    <path d="M34 42 C34 22 86 22 86 42 Z" fill="#3f8ed6"/><path d="M60 40 C74 40 96 40 100 46 C90 48 70 46 60 44 Z" fill="#2f6fb0"/>
    <circle cx="60" cy="24" r="3" fill="#2f6fb0"/>`,
  oneesan: () => `
    <path d="M60 34 L42 24 Q38 34 42 44 Z M60 34 L78 24 Q82 34 78 44 Z" fill="#e05a6d"/><circle cx="60" cy="34" r="5" fill="#c94458"/>`,
  otouto: () => `
    <path d="M58 36 q-6 -14 6 -18 q-8 8 2 18" fill="none" stroke="#a5863e" stroke-width="3" stroke-linecap="round"/>
    <rect x="80" y="66" width="12" height="6" rx="2" fill="#f7d9a8" transform="rotate(-20 86 69)"/>`,
  imouto: () => `
    <circle cx="34" cy="30" r="7" fill="#f28fb0"/><circle cx="86" cy="30" r="7" fill="#f28fb0"/>
    <circle cx="34" cy="30" r="2.4" fill="#fff" opacity=".7"/><circle cx="86" cy="30" r="2.4" fill="#fff" opacity=".7"/>`,
  ojiisan: () => `
    <path d="M36 48 q8 -6 16 0 M68 48 q8 -6 16 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M36 48 q8 -6 16 0 M68 48 q8 -6 16 0" stroke="#b9ad98" stroke-width="1.4" fill="none"/>
    <path d="M47 67 q6 -5 13 0 q7 -5 13 0 q-6 7 -13 3 q-7 4 -13 -3 z" fill="#fff" stroke="#b9ad98" stroke-width="1.4"/>
    <path d="M32 40 C34 24 86 24 88 40 Z" fill="#a8916e"/><rect x="30" y="38" width="60" height="5" rx="2.5" fill="#8c7756"/>`,
  obaasan: () => `
    <circle cx="60" cy="30" r="12" fill="#cfcad6" stroke="#aaa3b6" stroke-width="2"/><path d="M50 30 q10 6 20 0" stroke="#aaa3b6" stroke-width="2" fill="none"/>
    <g fill="none" stroke="#8a6fa8" stroke-width="2"><circle cx="44" cy="59" r="8"/><circle cx="76" cy="59" r="8"/><path d="M52 58 h16"/></g>`,
};

// One family member. 'watashi' is the player's own Mochi (with their outfit).
export function memberSVG(role, mood = 'idle', look) {
  if (role === 'watashi') return mochiSVG(mood, look);
  const m = MEMBERS[role];
  const s = m.scale;
  const off = (1 - s) * 60;
  const hideSprout = ['oniisan', 'ojiisan', 'obaasan', 'oneesan'].includes(role);
  return `<svg viewBox="0 0 120 120" class="member-svg" aria-hidden="true">
    <ellipse cx="60" cy="112" rx="${34 * s}" ry="5" fill="#000" opacity=".08"/>
    <g transform="translate(${off} ${(1 - s) * 112}) scale(${s})">
      <path d="M36 44 C26 10 34 2 42 6 C50 10 52 30 50 44 Z" fill="${m.body}" stroke="${m.line}" stroke-width="2"/>
      <path d="M40 38 C34 18 38 12 42 13 C46 15 47 28 46 38 Z" fill="${m.ear}"/>
      <path d="M84 44 C94 10 86 2 78 6 C70 10 68 30 70 44 Z" fill="${m.body}" stroke="${m.line}" stroke-width="2"/>
      <path d="M80 38 C86 18 82 12 78 13 C74 15 73 28 74 38 Z" fill="${m.ear}"/>
      <path d="M14 82 C14 50 34 36 60 36 C86 36 106 50 106 82 C106 104 86 110 60 110 C34 110 14 104 14 82 Z" fill="${m.body}" stroke="${m.line}" stroke-width="2.5"/>
      <ellipse cx="32" cy="72" rx="8" ry="5" fill="${m.cheek}" opacity=".75"/>
      <ellipse cx="88" cy="72" rx="8" ry="5" fill="${m.cheek}" opacity=".75"/>
      ${face(mood)}
      ${hideSprout ? '' : '<path d="M52 40 q8 -8 16 0" stroke="#7fb069" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="60" cy="34" r="4.5" fill="#7fb069"/>'}
      ${EXTRA[role]()}
    </g>
  </svg>`;
}

// The town: a calm street with three buildings. Closed ones have a little construction sign.
export function townSVG(open) {
  const sign = (x) => `<g transform="translate(${x} 300)"><rect x="-4" y="0" width="6" height="46" fill="#8c7756"/><rect x="40" y="0" width="6" height="46" fill="#8c7756"/>
    <rect x="-14" y="-8" width="70" height="30" rx="4" fill="#ffd166" stroke="#3b3355" stroke-width="2"/>
    <path d="M-6 -8 l14 30 M14 -8 l14 30 M34 -8 l14 30" stroke="#3b3355" stroke-width="5" opacity=".85"/></g>`;
  return `<svg viewBox="0 0 1180 470" class="town-svg" aria-hidden="true">
    <rect x="0" y="0" width="1180" height="470" rx="28" fill="#dff0f7"/>
    <circle cx="1060" cy="80" r="40" fill="#ffe08a"/>
    <path d="M0 250 Q200 180 420 230 T820 210 T1180 230 V470 H0 Z" fill="#cfe6c0"/>
    <rect x="0" y="372" width="1180" height="66" fill="#e9dcc4"/><path d="M0 405 H1180" stroke="#fff" stroke-width="5" stroke-dasharray="26 22"/>
    <!-- house -->
    <g transform="translate(110 150)"><path d="M0 110 L120 20 L240 110 Z" fill="#e05a6d"/><rect x="24" y="108" width="192" height="114" fill="#fff6e6" stroke="#e2d7c1" stroke-width="3"/>
      <rect x="100" y="150" width="42" height="72" rx="6" fill="#a8774a"/><rect x="40" y="134" width="42" height="36" rx="4" fill="#bfe3f2"/><rect x="160" y="134" width="42" height="36" rx="4" fill="#bfe3f2"/></g>
    <!-- streets / signpost -->
    <g transform="translate(500 170)" opacity="${open.directions ? 1 : 0.55}"><rect x="96" y="20" width="10" height="200" fill="#8c7756"/>
      <path d="M106 40 h90 l22 20 l-22 20 h-90 z" fill="#7fb069"/><path d="M96 96 h-90 l-22 20 l22 20 h90 z" fill="#4a90c2"/><path d="M106 150 h80 l22 20 l-22 20 h-80 z" fill="#f2a541"/></g>
    ${open.directions ? '' : sign(560)}
    <!-- food shop -->
    <g transform="translate(830 150)" opacity="${open.food ? 1 : 0.55}"><rect x="0" y="60" width="240" height="162" fill="#fff6e6" stroke="#e2d7c1" stroke-width="3"/>
      <path d="M-10 60 h260 l-14 -46 h-232 z" fill="#2b3a67"/>${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i * 40}" y="60" width="20" height="26" fill="#e05a6d"/>`).join('')}
      <rect x="20" y="104" width="200" height="70" rx="6" fill="#bfe3f2"/><circle cx="70" cy="140" r="16" fill="#fff"/><ellipse cx="70" cy="136" rx="12" ry="7" fill="#f28c6a"/><circle cx="150" cy="140" r="16" fill="#fff"/><ellipse cx="150" cy="136" rx="12" ry="7" fill="#ffd166"/></g>
    ${open.food ? '' : sign(905)}
  </svg>`;
}
