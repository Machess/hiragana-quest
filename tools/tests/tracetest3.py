import asyncio, json
from playwright.async_api import async_playwright
JS = r"""
async ({mode, level}) => {
  const T = await import('./js/trace.js');
  const D = await import('./js/data.js');
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const out = {};
  for (const k of D.KANA) {
    const h = k.h;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:545px;height:545px;z-index:999';
    document.body.append(box);
    let done = null, fails = 0;
    const pad = T.createTracePad({ h, level, onStroke: (ok) => { if (!ok) fails++; }, onDone: (r) => (done = r) });
    box.append(pad.node);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const canvas = pad.node.querySelector('.tp-ink');
    const R = canvas.getBoundingClientRect(); const S = R.width / 109;
    let strokes = T.template(h).map((s) => s.pts.map((p) => ({ ...p })));
    // smooth wobble: low-frequency offset plus tiny noise
    const wobble = (pts, amp) => { const ph = rnd() * 6, ph2 = rnd() * 6; return pts.map((p, i) => ({ x: p.x + Math.sin(i / 7 + ph) * amp + (rnd() - .5), y: p.y + Math.cos(i / 9 + ph2) * amp + (rnd() - .5) })); };
    if (mode === 'wobble') strokes = strokes.map((s) => wobble(s, 3).map((p) => ({ x: p.x + 3, y: p.y - 2 })));
    if (mode === 'small') strokes = strokes.map((s) => wobble(s, 2).map((p) => ({ x: p.x * 0.6 + 6, y: p.y * 0.6 + 30 })));
    if (mode === 'reverse') strokes[0] = strokes[0].slice().reverse();
    if (mode === 'order') { if (strokes.length < 2) { box.remove(); pad.destroy(); continue; } [strokes[0], strokes[1]] = [strokes[1], strokes[0]]; }
    if (mode === 'scribble') strokes = strokes.map((s) => s.map((p, i) => ({ x: 20 + rnd() * 70, y: 20 + rnd() * 70 })));
    const fire = (type, p) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true, clientX: R.left + p.x * S, clientY: R.top + p.y * S, isPrimary: true }));
    const limit = level === 3 ? strokes.length : ((mode === 'reverse' || mode === 'order' || mode === 'scribble') ? 1 : strokes.length);
    for (const s of strokes.slice(0, limit)) {
      fire('pointerdown', s[0]);
      for (const p of s.slice(1)) fire('pointermove', p);
      fire('pointerup', s[s.length - 1]);
      await new Promise((r) => setTimeout(r, 5));
    }
    // level 3 only judges after the last stroke
    if (level === 3 && limit === 1 && strokes.length > 1) { out[h] = 'n/a'; }
    else out[h] = done ? (fails ? 'pass-after-miss' : 'pass') : (fails ? 'caught' : 'pending');
    pad.destroy(); box.remove();
  }
  return out;
}
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1280,'height':800})
        await pg.goto('http://localhost:8765/'); await pg.wait_for_timeout(500)
        for level in (3,):
            for mode in ('exact','wobble','small','reverse','order','scribble'):
                if mode in ('exact','wobble','small'): continue
                r = await pg.evaluate(JS, {'mode':mode,'level':level})
                from collections import Counter
                c = Counter(r.values())
                bad = {h:v for h,v in r.items() if (mode in ('exact','wobble','small') and v!='pass') or (mode in ('reverse','order','scribble') and v not in ('caught','n/a'))}
                print(f'level {level} {mode:9s}', dict(c), 'PROBLEMS:' if bad else '', ''.join(f'{h}:{v} ' for h,v in bad.items()))
        await b.close()
asyncio.run(main())
