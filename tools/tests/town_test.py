import asyncio, json, sys
from playwright.async_api import async_playwright
URL = 'http://localhost:8765/'
SHOTS = '/home/claude/test/shots/town-'
errors = []

async def setup(pg, open_all=True, all_gold=False):
    await pg.goto(URL); await pg.wait_for_timeout(600)
    await pg.click('text=New player'); await pg.fill('.name-input', 'Hana'); await pg.click('text=Start!'); await pg.wait_for_timeout(800)
    await pg.evaluate("""([openAll, gold]) => { const st = JSON.parse(localStorage.getItem('hiraganaQuest.v1'));
      st.settings.openAll = openAll; const p = st.profiles[0];
      if (gold) { p.units = {}; 'a ka sa ta na ha ma ya ra wa'.split(' ').forEach(() => {}); }
      localStorage.setItem('hiraganaQuest.v1', JSON.stringify(st)); }""", [open_all, all_gold])
    await pg.reload(); await pg.wait_for_timeout(900)

async def tap(pg, sel):
    await pg.locator(sel).first.click(timeout=15000, force=True)

async def wait_enabled(pg, sel, t=20000):
    await pg.locator(sel).first.wait_for(state='visible', timeout=t)
    for _ in range(t // 100):
        if await pg.locator(sel).first.is_enabled(): return
        await pg.wait_for_timeout(100)

async def finish(pg, name):
    await pg.locator('.screen.town-done').wait_for(timeout=60000)
    await pg.screenshot(path=f'{SHOTS}{name}-done.png')
    await wait_enabled(pg, '.screen.town-done .btn.big')
    await tap(pg, '.screen.town-done .btn.big')
    await pg.locator('.screen.town-family').wait_for(timeout=10000)

async def target(pg):
    for _ in range(200):
        t = await pg.evaluate("(document.querySelector('.view')||{dataset:{}}).dataset.target")
        if t: return t
        if await pg.locator('.screen.town-done').count(): return None
        await pg.wait_for_timeout(100)

async def lesson_meet(pg):
    for i in range(9):
        await pg.locator('.member.glow').first.wait_for(timeout=20000)
        if i == 0: await pg.wait_for_timeout(600); await pg.screenshot(path=f'{SHOTS}meet.png')
        await tap(pg, '.member.glow')

async def lesson_who(pg, wrong_first=True):
    for i in range(9):
        t = await target(pg)
        if not t: return
        if i == 0: await pg.wait_for_timeout(600); await pg.screenshot(path=f'{SHOTS}who.png')
        if wrong_first and i == 2:
            other = 'otousan' if t != 'otousan' else 'okaasan'
            await tap(pg, f'.member[data-role="{other}"]'); await pg.wait_for_timeout(1800)
        await tap(pg, f'.member[data-role="{t}"]')
        await pg.wait_for_function("(t) => (document.querySelector('.view')||{dataset:{}}).dataset.target !== t || document.querySelector('.screen.town-done')", arg=t, timeout=30000)

async def lesson_names(pg):
    for i in range(7):
        t = await target(pg)
        if not t: return
        await pg.locator(f'.word-card[data-role="{t}"]').wait_for(timeout=20000)
        if i == 0: await pg.wait_for_timeout(600); await pg.screenshot(path=f'{SHOTS}names.png')
        await tap(pg, f'.word-card[data-role="{t}"]')
        await pg.wait_for_function("(t) => (document.querySelector('.view')||{dataset:{}}).dataset.target !== t || document.querySelector('.screen.town-done')", arg=t, timeout=30000)

async def lesson_tree(pg):
    await pg.locator('.word-card').first.wait_for(timeout=20000)
    await pg.wait_for_timeout(800); await pg.screenshot(path=f'{SHOTS}tree.png')
    roles = await pg.evaluate("[...document.querySelectorAll('.word-card')].map(c => c.dataset.role)")
    for k, r in enumerate(roles):
        await tap(pg, f'.word-card[data-role="{r}"]')
        if k == 1:   # one wrong placement
            other = roles[-1]
            await tap(pg, f'.member[data-role="{other}"]'); await pg.wait_for_timeout(600)
            await tap(pg, f'.word-card[data-role="{r}"]')
        await tap(pg, f'.member[data-role="{r}"]'); await pg.wait_for_timeout(300)

async def lesson_say(pg):
    for i in range(4):
        t = await target(pg)
        if i == 0: await pg.wait_for_timeout(600); await pg.screenshot(path=f'{SHOTS}say-a.png')
        await tap(pg, f'.member[data-role="{t}"]')
        await pg.wait_for_function("(t) => (document.querySelector('.view')||{dataset:{}}).dataset.target !== t", arg=t, timeout=30000)
    for i in range(4):
        await pg.locator('.word-card.tile').first.wait_for(timeout=30000)
        if i == 0: await pg.wait_for_timeout(300); await pg.screenshot(path=f'{SHOTS}say-b.png')
        n = await pg.locator('.word-card.tile').count()
        for k in range(n):
            await tap(pg, f'.word-card.tile[data-i="{k}"]'); await pg.wait_for_timeout(250)
        if i == 0: await pg.screenshot(path=f'{SHOTS}say-b-done.png')
        await pg.wait_for_function("() => !document.querySelector('.word-card.tile') || document.querySelector('.screen.town-done')", timeout=30000)

async def lesson_mine(pg):
    await pg.locator('.mine-row').first.wait_for(timeout=20000)
    rows = pg.locator('.mine-row')
    await rows.nth(1).locator('.step-btn').nth(1).click()   # a grandma
    await rows.nth(4).locator('.step-btn').nth(1).click()   # a big brother
    await rows.nth(7).locator('.step-btn').nth(1).click()   # a little sister
    await rows.nth(7).locator('.step-btn').nth(1).click()   # another
    await pg.wait_for_timeout(500)
    await pg.screenshot(path=f'{SHOTS}mine.png')
    await wait_enabled(pg, '.mine-right .btn.big'); await tap(pg, '.mine-right .btn.big')
    await pg.wait_for_timeout(9000); await pg.screenshot(path=f'{SHOTS}mine-present.png')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1280, 'height': 800})).new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        await pg.add_init_script("""(() => { const P = HTMLMediaElement.prototype; })()""")
        # Locked for a new player without openAll
        await setup(pg, open_all=False)
        await pg.screenshot(path=f'{SHOTS}home-locked.png')
        await tap(pg, '.town-tile'); await pg.wait_for_timeout(400)
        print('locked message:', await pg.inner_text('.home-mochi .bubble'))
        # Open everything
        await pg.evaluate("() => { const st = JSON.parse(localStorage.getItem('hiraganaQuest.v1')); st.settings.openAll = true; localStorage.setItem('hiraganaQuest.v1', JSON.stringify(st)); }")
        await pg.reload(); await pg.wait_for_timeout(900)
        await tap(pg, '.town-tile'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'{SHOTS}map.png')
        await tap(pg, '.town-spot.s-house'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{SHOTS}house.png')
        for name, fn in [('meet', lesson_meet), ('who', lesson_who), ('names', lesson_names), ('tree', lesson_tree), ('say', lesson_say), ('mine', lesson_mine)]:
            await tap(pg, '.lesson.next')
            await fn(pg)
            await finish(pg, name)
            st = await pg.evaluate("JSON.parse(localStorage.getItem('hiraganaQuest.v1')).profiles[0].town")
            print(name, 'done ->', st['family']['done'], '| koban', await pg.evaluate("JSON.parse(localStorage.getItem('hiraganaQuest.v1')).profiles[0].coins"))
        await pg.screenshot(path=f'{SHOTS}house-after.png')
        print('my family:', json.dumps((await pg.evaluate("JSON.parse(localStorage.getItem('hiraganaQuest.v1')).profiles[0].town"))['family'].get('my')))
        await b.close()
    print('ERRORS', errors)
asyncio.run(main())
