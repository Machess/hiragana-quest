import asyncio, json
from playwright.async_api import async_playwright
m=open('misc.py').read(); exec(m[:m.index('async def main')])
async def main():
    errs=[]
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1280,'height':800}, device_scale_factor=1.5); pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
        await pg.goto('http://localhost:8765/')
        await pg.evaluate("s => localStorage.setItem('hiraganaQuest.v1', JSON.stringify(s))", state(gold=True))  # old-format save
        await pg.reload(); await pg.wait_for_timeout(800)
        await pg.click('text=Yuki'); await pg.wait_for_timeout(900); await pg.screenshot(path='shots/f-home.png')
        steps = await pg.evaluate("import('./js/learn.js').then(L => import('./js/store.js').then(S => { const p=S.profiles()[0]; return Object.keys(p.chars).map(h => h + L.stepOf(p,h)).join(' '); }))")
        print('migrated steps:', steps)
        await pg.click('text=My Hiragana'); await pg.wait_for_timeout(600); await pg.screenshot(path='shots/f-chart.png')
        await pg.click('.back'); await pg.click('text=Dojo'); await pg.wait_for_timeout(500); await pg.screenshot(path='shots/f-dojo.png')
        await pg.click('.dojo-tile:has-text("Karuta")'); await pg.wait_for_timeout(400)
        await pg.click('text=Play with Ren'); await pg.wait_for_timeout(2200); await pg.screenshot(path='shots/f-karuta-duo.png')
        await pg.click('.game-top .icon-btn'); await pg.click('.modal .btn:not(.soft)'); await pg.wait_for_timeout(600)
        print('back at dojo:', await pg.locator('.screen.dojo').count()==1)
        await pg.click('.back'); await pg.click('text=Trophies'); await pg.wait_for_timeout(600); await pg.screenshot(path='shots/f-trophies.png')
        await b.close()
    print('errors:', errs)
asyncio.run(main())
