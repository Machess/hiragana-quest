import asyncio, json
from playwright.async_api import async_playwright
src = open('misc.py').read(); exec(src[:src.index('async def main')])
MEASURE = open('perf.py').read().split('MEASURE = """')[1].split('"""')[0]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1280,'height':800}, device_scale_factor=1.5)
        pg = await ctx.new_page(); cdp = await ctx.new_cdp_session(pg); await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        await pg.goto('http://localhost:8765/')
        await pg.evaluate("s => localStorage.setItem('hiraganaQuest.v1', JSON.stringify(s))", state(gold=False))
        await pg.reload(); await pg.wait_for_timeout(1500); await pg.click('text=Yuki'); await pg.click('text=Free play')
        for name in ['Sushi Train','Stepping Stones','Spot the Different One','Sound Detective']:
            await pg.click(f'text={name}'); await pg.wait_for_timeout(1500)
            await pg.evaluate("import('./js/ui.js').then(u => u.petals(18))")
            print(f'{name:24s}', await pg.evaluate(MEASURE, 2500))
            await pg.click('.game-top .icon-btn'); await pg.click('.modal .btn:not(.soft)'); await pg.wait_for_timeout(500)
        await b.close()
asyncio.run(main())
