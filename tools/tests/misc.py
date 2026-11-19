import asyncio, json
from playwright.async_api import async_playwright
SH='/home/claude/test/shots'
def state(gold=False):
    chars={}
    for i,h in enumerate('あいうえおかきくけこさし'):
        m = 0.95 if (gold and i<5) else (0.75 if i<5 else 0.5 if i<10 else 0.3)
        chars[h]={'hear':m,'write':m,'intro':1,'last':0,'seen':5,'days':4,'lastDay':'x'}
    troph={h:(3 if gold and i<5 else 2 if i<10 else 1) for i,h in enumerate('あいうえおかきくけこさし')}
    p1={'id':'p1','name':'Yuki','avatar':'🐧','color':'#2a9d8f','chars':chars,'trophies':troph,'rowTrophies':{'a':True} if gold else {},'stamps':[{'date':1700000000000+i*86400000,'h':h,'chars':[h]} for i,h in enumerate('あいうえおかきくけこさしあいう')],'mochiSpeed':4000,'bestStreak':12}
    p2=dict(p1); p2.update(id='p2',name='Ren',avatar='🦊',color='#e4572e')
    return {'profiles':[p1,p2],'settings':{'volume':.9,'romaji':False},'lastProfileId':None}
async def main():
    errs=[]
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for vw,vh,tag in [(1280,800,'land')]:
            pg = await b.new_page(viewport={'width':vw,'height':vh})
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
            await pg.goto('http://localhost:8765/')
            await pg.evaluate("s => localStorage.setItem('hiraganaQuest.v1', JSON.stringify(s))", state(gold=True))
            await pg.reload(); await pg.wait_for_timeout(700)
            await pg.screenshot(path=f'{SH}/m-{tag}-profiles.png')
            await pg.click('text=Yuki'); await pg.wait_for_timeout(700); await pg.screenshot(path=f'{SH}/m-{tag}-home.png')
            await pg.click('text=Trophies'); await pg.wait_for_timeout(600); await pg.screenshot(path=f'{SH}/m-{tag}-trophies.png')
            await pg.click('.back'); await pg.click('text=Free play'); await pg.click('text=Karuta'); await pg.wait_for_timeout(400)
            await pg.screenshot(path=f'{SH}/m-{tag}-karuta-setup.png')
            await pg.click('text=Play with Ren'); await pg.wait_for_timeout(1800); await pg.screenshot(path=f'{SH}/m-{tag}-karuta-duo.png')
            # leave mid-game
            await pg.click('.game-top .icon-btn'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{SH}/m-{tag}-leave.png')
            await pg.click('.modal .btn:not(.soft)'); await pg.wait_for_timeout(500)
            # portrait views of trace + listen + memory via free play
            for g in ['Trace','Listen & Pick','Memory Match','Goldfish Scoop','Picture Write']:
                await pg.click(f'text={g}'); await pg.wait_for_timeout(1500)
                await pg.screenshot(path=f'{SH}/m-{tag}-{g.split()[0].lower()}.png')
                await pg.click('.game-top .icon-btn'); await pg.click('.modal .btn:not(.soft)'); await pg.wait_for_timeout(400)
            await pg.click('.back'); await pg.click('.back'); await pg.wait_for_timeout(300)
            # parent area via hold
            btn = pg.locator('.hold-btn'); bb = await btn.bounding_box()
            await pg.mouse.move(bb['x']+20, bb['y']+10); await pg.mouse.down(); await pg.wait_for_timeout(2300); await pg.mouse.up()
            await pg.wait_for_timeout(400); await pg.click('details.pp summary >> nth=0'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'{SH}/m-{tag}-parent.png', full_page=True)
            await pg.close()
        await b.close()
    print('errors:', errs)
asyncio.run(main())
