import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width':1280,'height':800})).new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        req=[]; pg.on('request', lambda r: req.append(r.url.split('/audio/')[-1]) if '/audio/voice' in r.url else None)
        await pg.goto('http://localhost:8765/'); await pg.wait_for_timeout(500)
        await pg.click('text=New player'); await pg.fill('.name-input','Mia'); await pg.click('text=Start!'); await pg.wait_for_timeout(2500)
        print('home voice requests', req)
        await pg.locator('.back').first.click(); await pg.wait_for_timeout(300)
        btn = pg.locator('.hold-btn'); bb = await btn.bounding_box()
        await pg.mouse.move(bb['x']+20, bb['y']+10); await pg.mouse.down(); await pg.wait_for_timeout(2400); await pg.mouse.up(); await pg.wait_for_timeout(500)
        await pg.screenshot(path='/home/claude/test/shots/parent-echo.png')
        await pg.click('text=Off (Japanese only)'); await pg.wait_for_timeout(200)
        st = await pg.evaluate("JSON.parse(localStorage.getItem('hiraganaQuest.v1')).settings.echo")
        print('setting saved:', st, 'errors', errs)
        await b.close()
asyncio.run(main())
