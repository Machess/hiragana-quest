import asyncio, json
from playwright.async_api import async_playwright
exec(open('misc.py').read().split('async def main')[0])
MEASURE = """async (ms) => { const d=[]; let last=performance.now(); const end=last+ms;
  await new Promise(r => { const f=t=>{ d.push(t-last); last=t; if(t<end) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  d.sort((a,b)=>a-b); const p=q=>d[Math.floor(q*(d.length-1))];
  return {frames:d.length, fps:Math.round(1000*d.length/ms), p50:+p(.5).toFixed(1), p95:+p(.95).toFixed(1), worst:+d[d.length-1].toFixed(1), janky:d.filter(x=>x>34).length}; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--enable-gpu-rasterization'])
        ctx = await b.new_context(viewport={'width':1280,'height':800}, device_scale_factor=1.5)
        pg = await ctx.new_page()
        cdp = await ctx.new_cdp_session(pg); await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        await pg.goto('http://localhost:8765/')
        await pg.evaluate("s => localStorage.setItem('hiraganaQuest.v1', JSON.stringify(s))", state(gold=True))
        await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.click('text=Yuki'); await pg.wait_for_timeout(1200)
        print('home idle      ', await pg.evaluate(MEASURE, 2000))
        await pg.click('text=Free play'); await pg.click('text=Goldfish Scoop'); await pg.wait_for_timeout(1500)
        print('goldfish       ', await pg.evaluate(MEASURE, 3000))
        await pg.evaluate("import('./js/ui.js').then(u => { u.petals(18); })")
        print('goldfish+petals', await pg.evaluate(MEASURE, 2500))
        await pg.click('.game-top .icon-btn'); await pg.click('.modal .btn:not(.soft)'); await pg.wait_for_timeout(500)
        await pg.click('text=Memory Match'); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelectorAll('.card').forEach((c,i)=> i<4 && c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})))")
        print('memory flips   ', await pg.evaluate(MEASURE, 1500))
        await pg.click('.game-top .icon-btn'); await pg.click('.modal .btn:not(.soft)'); await pg.wait_for_timeout(500)
        await pg.click('text=Trace'); await pg.wait_for_timeout(1200)
        box = await pg.locator('.trace-pad').bounding_box()
        async def scribble():
            await pg.mouse.move(box['x']+100, box['y']+100); await pg.mouse.down()
            for i in range(120): await pg.mouse.move(box['x']+100+i*3, box['y']+100+(i%20)*8)
            await pg.mouse.up()
        t = asyncio.create_task(scribble())
        r = await pg.evaluate(MEASURE, 2000); await t
        print('tracing        ', r)
        await b.close()
asyncio.run(main())
