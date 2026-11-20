import asyncio, json
from playwright.async_api import async_playwright
exec(open('misc.py').read().split('async def main')[0])
async def draw_char(pg, h, jitter=0):
    pts = await pg.evaluate("h => import('./js/trace.js').then(m => m.template(h).map(s => s.pts))", h)
    box = await pg.locator('.trace-pad').bounding_box()
    k = box['width']/109
    for stroke in pts:
        sel = stroke[::2] + [stroke[-1]]
        await pg.mouse.move(box['x']+sel[0]['x']*k, box['y']+sel[0]['y']*k)
        await pg.mouse.down()
        for p in sel[1:]:
            await pg.mouse.move(box['x']+p['x']*k+jitter, box['y']+p['y']*k+jitter)
        await pg.mouse.up()
        await pg.wait_for_timeout(120)


TAP = "el => el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}))"
async def step(pg, kind):
    v = pg.locator('.view').first
    t = await v.get_attribute('data-target')
    if not t: return False
    if kind == 'detective':
        opts = await v.get_attribute('data-options'); i = opts.index(t)
        await pg.locator('.det-option .det-pick').nth(i).evaluate(TAP)
    elif kind == 'spot':
        await pg.locator(f'.spot-cell[data-h="{t}"]').first.evaluate(TAP)
    elif kind == 'sushi':
        idx = await pg.locator('.sushi-slot.filled').count()
        if idx >= len(t): return False
        c = t[idx]
        # tap a matching plate that is actually on screen
        ok = await pg.evaluate("""c => { const W = document.querySelector('.belt').getBoundingClientRect();
          const ps = [...document.querySelectorAll('.plate')].filter(p => p.dataset.h === c && !p.classList.contains('taken'));
          const vis = ps.find(p => { const r = p.getBoundingClientRect(); return r.left > W.left + 20 && r.right < W.right - 20; });
          if (!vis) return false; vis.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); return true; }""", c)
        if not ok: await pg.wait_for_timeout(300); return True
    elif kind == 'readmatch':
        loc = pg.locator(f'.rm-pic[data-w="{t}"]')
        if await loc.count() == 0: return False
        await loc.first.evaluate(TAP)
    elif kind == 'dictation':
        await pg.wait_for_timeout(500)
        await draw_char(pg, await pg.evaluate("window.__lastTraceChar"))
        await pg.wait_for_timeout(2600)
    elif kind == 'river':
        loc = pg.locator(f'.stone-btn[data-h="{t}"]:not(.gone)')
        if await loc.count() == 0: return False
        await loc.first.evaluate(TAP)
    return True

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':1280,'height':800}, device_scale_factor=1.5)
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
        await pg.goto('http://localhost:8765/')
        await pg.evaluate("s => localStorage.setItem('hiraganaQuest.v1', JSON.stringify(s))", state(gold=False))
        await pg.reload(); await pg.wait_for_timeout(800)
        await pg.click('text=Yuki'); await pg.click('text=Dojo'); await pg.wait_for_timeout(600)
        await pg.click('text=Everything I know'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='shots/n-dojo.png')
        for name, kind in [('Sound Detective','detective'),('Spot the Different','spot'),('Read & Match','readmatch'),('Dictation','dictation'),('Sushi Train','sushi'),('Stepping Stones','river')]:
            await pg.click(f'.dojo-tile:has-text("{name}")'); await pg.wait_for_timeout(1600)
            await pg.screenshot(path=f'shots/n-{kind}-1.png')
            shots = 1; t0 = asyncio.get_event_loop().time(); acts = 0
            while asyncio.get_event_loop().time() - t0 < 180:
                if await pg.locator('.screen.dojo').count(): break
                if await pg.locator('.screen.summary').count():
                    if shots < 9: await pg.screenshot(path=f'shots/n-summary-{kind}.png'); shots = 9
                    await pg.click('text=Next'); continue
                if await pg.locator('.screen.ceremony').count():
                    await pg.wait_for_timeout(3000); await pg.click('text=Next'); continue
                if await pg.locator('.screen.dojo-end').count():
                    await pg.click('.dojo-end .btn.soft'); continue
                if await pg.locator(f'.view.{kind}').count():
                    if await step(pg, kind): acts += 1
                    await pg.wait_for_timeout(250 if kind=='sushi' else 500)
                    if acts in (3, 7) and shots < 3:
                        shots += 1; await pg.screenshot(path=f'shots/n-{kind}-{shots}.png')
                else:
                    await pg.wait_for_timeout(300)
            print(kind, 'actions', acts, 'back to dojo:', await pg.locator('.screen.dojo').count() == 1)
        st = await pg.evaluate("JSON.parse(localStorage.getItem('hiraganaQuest.v1')).profiles[0].bestStreak")
        print('best streak', st)
        await b.close()
    print('errors:', errs)
asyncio.run(main())
