import asyncio, json, sys
sys.path.insert(0, '/home/claude/test')
from playwright.async_api import async_playwright
from run import play_view, step, wait_view, TAP
URL='http://localhost:8765/'
errors=[]
async def new_profile(pg, chars):
    await pg.goto(URL); await pg.wait_for_timeout(600)
    await pg.click('text=New player'); await pg.fill('.name-input','Kai'); await pg.click('text=Start!'); await pg.wait_for_timeout(600)
    # give the profile some introduced characters
    await pg.evaluate("""chars => { const st = JSON.parse(localStorage.getItem('hiraganaQuest.v1'));
      const p = st.profiles[0];
      chars.split('').forEach((h, i) => p.chars[h] = { step: 4, prog: 0, cnt: {}, intro: 1, last: Date.now() - 864e5, hear: i < 4 ? 0.1 : 0.9, read: i < 4 ? 0.1 : 0.9, write: 0.5, days: 1, lastDay: 'x' });
      localStorage.setItem('hiraganaQuest.v1', JSON.stringify(st)); }""", chars)
    await pg.reload(); await pg.wait_for_timeout(700)
async def run_game(pg, game, sel):
    await pg.click('text=Dojo'); await pg.wait_for_timeout(400)
    await pg.click('text=Clear')
    for h in sel: await pg.locator(f'.chart-cell[data-h="{h}"]').click()
    await pg.locator('.dojo-tile', has_text=game).click()
    targets=[]; seen=set(); kinds=set()
    for i in range(400):
        await pg.wait_for_timeout(150)
        if await pg.locator('.screen.dojo-end').count(): break
        for nm in ('summary','ceremony'):
            if await pg.locator(f'.screen.{nm}').count(): await pg.wait_for_timeout(1500); await pg.click('text=Next')
        if await pg.locator('.view').count():
            t = await pg.evaluate("(document.querySelector('.view')||{}).dataset?.target")
            if t and (not targets or targets[-1][0]!=t or targets[-1][1]!=i-1): targets.append((t,i))
            k = await play_view(pg, seen); kinds.add(k)
    streak = await pg.evaluate("document.querySelectorAll('.lantern-bar .lit').length")
    return [t for t,_ in targets], kinds
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width':1280,'height':800})
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e))); pg.on('console', lambda m: m.type=='error' and errors.append(m.text))
        await pg.add_init_script("window.__lastTraceChar=null;")
        await new_profile(pg, 'あいうえおかきくけこさしすせそ')
        sel = 'あいうえおかきくけこ'
        for game in ['Spot the Different', 'Sound Detective', 'Listen & Pick']:
            t, k = await run_game(pg, game, sel)
            dedup = []
            for x in t:
                if not dedup or dedup[-1]!=x: dedup.append(x)
            print(game, 'rounds', len(dedup), ''.join(dedup), 'covers all:', set(sel) <= set(dedup))
            await pg.click('text=Back'); await pg.wait_for_timeout(300); await pg.click('.back'); await pg.wait_for_timeout(300)
        # Again rotation: 13 chosen with Detective (max 12) -> second run starts with the missing one(s)
        sel2 = 'あいうえおかきくけこさしす'
        t1, _ = await run_game(pg, 'Sound Detective', sel2)
        await pg.click('text=Again!'); await pg.wait_for_timeout(300)
        t2=[]; seen=set()
        for i in range(300):
            await pg.wait_for_timeout(150)
            if await pg.locator('.screen.dojo-end').count(): break
            for nm in ('summary','ceremony'):
                if await pg.locator(f'.screen.{nm}').count(): await pg.wait_for_timeout(1500); await pg.click('text=Next')
            if await pg.locator('.view').count():
                t = await pg.evaluate("(document.querySelector('.view')||{}).dataset?.target")
                if t and (not t2 or t2[-1]!=t): t2.append(t)
                await play_view(pg, seen)
        missing = set(sel2) - set(t1)
        print('again: first run missed', missing, '| second run starts with', t2[:len(missing)])
        await pg.click('text=Back'); await pg.wait_for_timeout(300); await pg.click('.back')
        # Sushi with one char selected that fits only a few words
        t, _ = await run_game(pg, 'Sushi Train', 'え')
        print('sushi rounds', t)
        await pg.click('text=Back'); await pg.wait_for_timeout(300); await pg.click('.back')
        # Memory: matches don't light lanterns or earn koban
        c0 = await pg.evaluate("JSON.parse(localStorage.getItem('hiraganaQuest.v1')).profiles[0].coinProg||0")
        await pg.click('text=Dojo'); await pg.click('text=Clear')
        for h in 'あいうえおか': await pg.locator(f'.chart-cell[data-h="{h}"]').click()
        await pg.locator('.dojo-tile', has_text='Memory').click(); await pg.wait_for_timeout(800)
        await play_view(pg, set())
        lit = await pg.evaluate("document.querySelectorAll('.lantern-bar .lit').length")
        c1 = await pg.evaluate("JSON.parse(localStorage.getItem('hiraganaQuest.v1')).profiles[0].coinProg||0")
        print('memory: lanterns lit', lit, '| koban progress before/after', c0, c1)
        await b.close()
    print('ERRORS', errors)
asyncio.run(main())
