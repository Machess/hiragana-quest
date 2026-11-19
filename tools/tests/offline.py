import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/'); 
        await pg.wait_for_function("navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(()=>true)", timeout=20000)
        await pg.wait_for_timeout(3000)
        n = await pg.evaluate("caches.keys().then(ks => caches.open(ks[0])).then(c => c.keys()).then(k => k.length)")
        await ctx.set_offline(True); await pg.reload(); await pg.wait_for_timeout(1000)
        ok = await pg.evaluate("!!document.querySelector('.screen')")
        snd = await pg.evaluate("fetch('audio/kana/ka.mp3').then(r=>r.status)")
        print('cached', n, 'offline render', ok, 'offline audio', snd, errs)
        await b.close()
asyncio.run(main())
