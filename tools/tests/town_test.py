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

async def finish(pg, name, back='.screen.town-family'):
    await pg.locator('.screen.town-done').wait_for(timeout=120000)
    await pg.screenshot(path=f'{SHOTS}{name}-done.png')
    await wait_enabled(pg, '.screen.town-done .btn.big')
    await tap(pg, '.screen.town-done .btn.big')
    await pg.locator(back).wait_for(timeout=10000)

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

MOVEW = {'hidari': 'L', 'massugu': 'F', 'migi': 'R', 'tomatte': 'S'}
async def changed(pg, t, ms=60000):
    await pg.wait_for_function("(t) => (document.querySelector('.view')||{dataset:{}}).dataset.target !== t || document.querySelector('.screen.town-done')", arg=t, timeout=ms)

async def d_words(pg):
    await pg.locator('.dir-word').first.wait_for(timeout=20000); await pg.wait_for_timeout(600)
    await pg.screenshot(path=f'{SHOTS}d-words.png')
    for w in ['hidari', 'massugu', 'migi', 'tomatte']:
        await tap(pg, f'.dir-word[data-w="{w}"]')
        await pg.locator(f'.dir-word[data-w="{w}"].right').wait_for(timeout=20000)

async def d_doit(pg):
    for i in range(8):
        t = await target(pg)
        if not t: return
        if i == 0: await pg.wait_for_timeout(500); await pg.screenshot(path=f'{SHOTS}d-doit.png')
        if i == 1:
            wrong = 'R' if MOVEW[t.split('#')[0]] != 'R' else 'L'
            await tap(pg, f'.dir-btn[data-move="{wrong}"]'); await pg.wait_for_timeout(900)
        await tap(pg, f'.dir-btn[data-move="{MOVEW[t.split('#')[0]]}"]')
        await changed(pg, t)

async def d_places(pg):
    for i in range(9):
        await pg.locator('.place-btn.glow').first.wait_for(timeout=20000)
        if i == 0: await pg.wait_for_timeout(500); await pg.screenshot(path=f'{SHOTS}d-places.png')
        await tap(pg, '.place-btn.glow')
        await pg.wait_for_timeout(300)
    for i in range(11):
        t = await target(pg)
        if not t: return
        await pg.wait_for_timeout(400)
        if i == 6: await pg.screenshot(path=f'{SHOTS}d-read.png')
        await tap(pg, f'.place-btn[data-place="{t.split('#')[0]}"]')
        await changed(pg, t)

async def press_moves(pg, moves):
    for m in moves:
        await tap(pg, f'.dir-btn[data-move="{m}"]')
        await pg.wait_for_timeout(1000)

async def d_corners(pg, n=6, shot='d-corners'):
    for i in range(n):
        t = await target(pg)
        if not t: return
        await pg.wait_for_timeout(1500)
        if i == 0: await pg.screenshot(path=f'{SHOTS}{shot}.png')
        await press_moves(pg, t.split('#')[0])
        await changed(pg, t)

async def d_follow(pg):
    for i in range(14):
        if await pg.locator('.screen.town-done').count(): return
        t = await target(pg)
        if not t: return
        await pg.wait_for_timeout(1200)
        if i == 1: await pg.screenshot(path=f'{SHOTS}d-follow.png')
        await press_moves(pg, t.split('#')[0])
        await changed(pg, t)

async def d_challenge(pg):
    for i in range(4):
        t = await target(pg)
        if not t: return
        await pg.locator('.street-map.ask').wait_for(timeout=60000)
        if i == 0: await pg.screenshot(path=f'{SHOTS}d-challenge.png')
        await tap(pg, f'.place-btn[data-place="{t.split('#')[0]}"]')
        if i == 0: await pg.wait_for_timeout(3500); await pg.screenshot(path=f'{SHOTS}d-challenge-walk.png')
        await changed(pg, t, 90000)

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
        if 'directions' in sys.argv:
            await tap(pg, '.town-spot.s-streets'); await pg.wait_for_timeout(800)
            await pg.screenshot(path=f'{SHOTS}streets.png')
            for name, fn in [('words', d_words), ('doit', d_doit), ('places', d_places), ('corners', d_corners), ('follow', d_follow), ('challenge', d_challenge)]:
                await tap(pg, '.lesson.next')
                await fn(pg)
                await finish(pg, 'd-' + name, '.screen.town-streets')
                st = await pg.evaluate("JSON.parse(localStorage.getItem('hiraganaQuest.v1')).profiles[0].town")
                print(name, 'done ->', st['directions']['done'])
            await b.close(); print('ERRORS', errors); return
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
