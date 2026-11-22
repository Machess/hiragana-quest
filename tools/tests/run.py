import asyncio, sys, json, time, os, random
from playwright.async_api import async_playwright
import playwright

URL='http://localhost:8765/'
SH='/home/claude/test/shots'
errors=[]
TAKE_BONUS=[True]
MISS=[float(os.environ.get('MISS','0'))]
import random, os
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
        if await pg.locator(f'.spot-cell[data-h="{t}"]').count() == 0:
            info = await pg.evaluate("(() => { const v = document.querySelector('.view'); return v ? v.className + ' cells:' + [...new Set([...v.querySelectorAll('.spot-cell')].map(c => c.dataset.h))].join('') : 'none'; })()")
            print('SPOT DEBUG target', t, info); await shot(pg, 'spot-debug'); return False
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
    elif kind == 'river':
        loc = pg.locator(f'.stone-btn[data-h="{t}"]:not(.gone)')
        if await loc.count() == 0: return False
        await loc.first.evaluate(TAP)
    return True


async def wait_view(pg, timeout=15000):
    await pg.wait_for_selector('.view', timeout=timeout)
    return await pg.evaluate("(document.querySelector('.view') || {className: 'view none'}).className")

shot_n=[0]
async def shot(pg, name):
    shot_n[0]+=1
    await pg.screenshot(path=f'{SH}/{shot_n[0]:02d}-{name}.png')

async def play_view(pg, seen):
    cls = await wait_view(pg)
    kind = cls.replace('view','').strip().split()[0]
    if kind == 'none': return kind
    if kind not in seen:
        seen.add(kind); await pg.wait_for_timeout(700); await shot(pg, kind)
    if kind=='meet':
        await pg.click('text=Let’s write it!')
    elif kind in ('trace','picwrite','dictation'):
        await pg.wait_for_timeout(400)
        # the target char: for trace read from meet/pad? use hook: last spoken unknown -> get from STROKES by trying
        h = await pg.evaluate("window.__lastTraceChar")
        await draw_char(pg, h)
        await pg.wait_for_timeout(300)
        if kind not in [s+'-done' for s in seen]:
            seen.add(kind+'-done'); await shot(pg, kind+'-done')
        await pg.wait_for_function("!document.querySelector('.trace-pad') || !document.querySelector('.trace-pad.tp-done')", timeout=8000)
    elif kind=='listen':
        t = await pg.evaluate("(document.querySelector('.view')||{dataset:{}}).dataset.target")
        if not t: return kind
        if MISS[0] and random.random() < MISS[0]:
            wrong = pg.locator('.choice').filter(has_not_text=t)
            if await wrong.count(): await wrong.first.dispatch_event('pointerdown'); await pg.wait_for_timeout(500)
        await pg.locator('.choice', has_text=t).first.dispatch_event('pointerdown')
        await pg.wait_for_timeout(1100)
    elif kind=='goldfish':
        await pg.wait_for_timeout(600)
        t = await pg.evaluate("(document.querySelector('.view')||{dataset:{}}).dataset.target")
        ok = await pg.evaluate("t => { const f=[...document.querySelectorAll('.fish')].find(f => !f.classList.contains('leave') && f.querySelector('.fish-label').textContent===t); if(!f) return [...document.querySelectorAll('.fish')].map(f=>f.className+':'+f.textContent).join(','); f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); return 'ok'; }", t)
        if ok!='ok': print('goldfish miss', repr(t), ok); await shot(pg,'gf-debug')
        await pg.wait_for_timeout(1100)
    elif kind=='memory':
        hs = await pg.evaluate("[...new Set([...document.querySelectorAll('.card')].map(c=>c.dataset.h))]")
        for h in hs:
            cards = pg.locator(f'.card[data-h="{h}"]')
            if await cards.count() < 2: break
            await cards.nth(0).dispatch_event('pointerdown', timeout=3000); await pg.wait_for_timeout(250)
            if await cards.count() < 2: break
            await cards.nth(1).dispatch_event('pointerdown', timeout=3000)
            if h==hs[0]: await pg.wait_for_timeout(300); await shot(pg,'memory-flip')
            await pg.wait_for_timeout(900)
        await pg.wait_for_timeout(2600)
    elif kind=='karuta':
        for i in range(8):
            t = await pg.evaluate("document.querySelector('.stage').dataset.target")
            await pg.wait_for_timeout(900)
            n = await pg.locator(f'.k-card[data-h="{t}"]:not(.taken)').count()
            if n: await pg.locator(f'.k-card[data-h="{t}"]:not(.taken)').first.dispatch_event('pointerdown')
            await pg.wait_for_timeout(600)
            if await pg.locator('.view.karuta-end').count(): break
        await pg.wait_for_timeout(2800)
    elif kind in ('detective','spot','sushi','river','readmatch'):
        await step(pg, kind)
        await pg.wait_for_timeout(250 if kind=='sushi' else 450)
    elif kind=='check-card':
        await pg.wait_for_timeout(500)
        cls2 = await pg.evaluate("document.querySelector('.view').className")
        title = await pg.evaluate("(document.querySelector('.view h2')||{}).textContent")
        if 'start' in cls2 or 'pass' in cls2 or 'again' in cls2 or 'offer' in cls2:
            if cls2 not in seen: seen.add(cls2); await shot(pg, cls2.replace('view ','').replace(' ','-'))
        print('   [check]', cls2.replace('view check-card ',''), '|', title)
        if 'offer' in cls2:
            await pg.click('text=Next time' if TAKE_BONUS[0] is False else 'text=Yes!', timeout=15000)
        else:
            await pg.click('.view .btn.big', timeout=15000)
        await pg.wait_for_timeout(400)
    elif kind=='karuta-end':
        await pg.wait_for_timeout(2600)
    return kind

async def adventure(pg, seen, label):
    await pg.click('.adventure')
    for i in range(400):
        await pg.wait_for_timeout(200)
        if await pg.locator('.screen.summary').count():
            await pg.wait_for_timeout(1500); await shot(pg, f'summary-{label}')
            await pg.click('text=Next', timeout=15000); continue
        if await pg.locator('.screen.ceremony').count():
            await pg.wait_for_timeout(4000); await shot(pg, f'ceremony-{label}')
            await pg.click('text=Next', timeout=15000)
        if await pg.locator('.screen.stamp-end').count():
            await pg.wait_for_timeout(1800); await shot(pg, f'stamp-{label}')
            await pg.click('text=Done', timeout=15000); return
        if await pg.locator('.view').count():
            try:
                await play_view(pg, seen)
            except Exception as e:
                if 'Timeout' not in str(e) and 'null' not in str(e): raise
    raise Exception('adventure did not finish')

async def main(mode):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width':1280,'height':800}, device_scale_factor=1.5, has_touch=False)
        pg = await ctx.new_page(); pg.set_default_timeout(4000)
        pg.on('console', lambda m: m.type in ('error','warning') and errors.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await pg.add_init_script("""
          // test hook: remember which char a trace pad is for
          const _orig = window.fetch;
        """)
        await pg.add_init_script("""
          window.__audioLog = []; window.__views = [];
          new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && (n.classList.contains('view') || n.classList.contains('screen'))) window.__views.push({ t: performance.now(), c: n.className }); })
            .observe(document, { childList: true, subtree: true });
          const _start = AudioBufferSourceNode.prototype.start;
          AudioBufferSourceNode.prototype.start = function(...a) {
            const d = this.buffer ? this.buffer.duration : 0;
            const t0 = performance.now();
            window.__audioLog.push({ t0, t1: t0 + d * 1000, d });
            return _start.apply(this, a);
          };
        """)
        await pg.goto(URL); await pg.wait_for_timeout(800)
        await shot(pg,'profiles-empty')
        await pg.click('text=New player'); await pg.fill('.name-input','Yuki'); await shot(pg,'new-profile')
        await pg.click('text=Start!'); await pg.wait_for_timeout(900); await shot(pg,'home')
        seen=set()
        await adventure(pg, seen, 's1')
        await pg.wait_for_timeout(600); await shot(pg,'home-after')
        for s in range(2,int(mode)+1):
            # simulate a new day: make every char think it was last practised on another day
            await pg.evaluate("""() => { const st = JSON.parse(localStorage.getItem('hiraganaQuest.v1'));
              for (const c of Object.values(st.profiles[0].chars)) c.lastDay = 'yesterday';
              localStorage.setItem('hiraganaQuest.v1', JSON.stringify(st)); }""")
            await pg.reload(); await pg.wait_for_timeout(700)
            await adventure(pg, seen, f's{s}')
            lv = await pg.evaluate("(() => { const p = JSON.parse(localStorage.getItem('hiraganaQuest.v1')).profiles[0]; return Object.keys(p.chars).filter(h => p.chars[h].intro).join('') + ' units ' + JSON.stringify(p.units); })()")
            c = await pg.evaluate("JSON.parse(localStorage.getItem('hiraganaQuest.v1')).profiles[0].coins || 0")
            print('after session', s, 'introduced', lv, '| koban so far', c)
        await pg.click('text=Trophies'); await pg.wait_for_timeout(600); await shot(pg,'trophies')
        await pg.click('.back'); await pg.click('text=Dojo'); await pg.wait_for_timeout(500); await shot(pg,'dojo')
        await pg.click('.back'); await pg.click('text=My Hiragana'); await pg.wait_for_timeout(500); await shot(pg,'chart')
        await pg.locator('.chart-cell.met').first.click(); await pg.wait_for_timeout(1500); await shot(pg,'charcard')
        state = await pg.evaluate("JSON.parse(localStorage.getItem('hiraganaQuest.v1')).profiles[0]")
        print(json.dumps({h:(c.get('step'), c.get('prog')) for h,c in state['chars'].items()},ensure_ascii=False))
        print('trophies',state['trophies'],'stamps',len(state['stamps']),'mochiSpeed',state['mochiSpeed'])
        print('koban', state.get('coins',0), '(+', state.get('coinProg',0), 'answers toward the next one)')
        log = await pg.evaluate("window.__audioLog.filter(x => x.d >= 0.4).sort((a,b)=>a.t0-b.t0)")
        overl = sum(1 for a,b in zip(log, log[1:]) if b['t0'] < a['t1'] - 30)
        gaps = sorted(b['t0']-a['t1'] for a,b in zip(log, log[1:]) if b['t0'] >= a['t1'] - 30)
        views = await pg.evaluate("window.__views")
        cross = [(round(a['t0']), v['c']) for v in views for a in log if a['t0'] + 60 < v['t'] < a['t1'] - 60]
        print('speech still playing when the view changed:', len(cross), cross[:8])
        print(f"speech clips {len(log)}, overlapping pairs {overl}, shortest gaps ms {[round(g) for g in gaps[:5]]}, median gap {round(gaps[len(gaps)//2]) if gaps else None}")
        await b.close()
    print('ERRORS:', *errors[:30], sep='\n')
if __name__ == "__main__": asyncio.run(main(sys.argv[1] if len(sys.argv)>1 else "1"))
