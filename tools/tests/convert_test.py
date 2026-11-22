import asyncio, json
from playwright.async_api import async_playwright
def legacy():
    chars = {}
    steps = {'あ':6,'い':7,'う':8,'え':5,'お':4,'か':4,'き':3,'く':2}
    for h, st in steps.items():
        chars[h] = {'hear':.8,'read':.7,'write':.6,'intro':1,'last':0,'seen':20,'step':st,'prog':0,'cnt':{}}
    p = {'id':'p1','name':'Old','avatar':'🐼','color':'#2a9d8f','chars':chars,'trophies':{'あ':2,'い':2,'う':2,'え':1,'お':1,'か':1,'き':1},'rowTrophies':{},'stamps':[],'coins':40}
    return {'profiles':[p],'settings':{'volume':1},'lastProfileId':'p1'}
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(); pg = await (await b.new_context(viewport={'width':1280,'height':800})).new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/'); await pg.evaluate("s => localStorage.setItem('hiraganaQuest.v1', JSON.stringify(s))", legacy())
        await pg.reload(); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='/home/claude/test/shots/convert-home.png')
        st = await pg.evaluate("(async () => { const L = await import('./js/learn.js'); const S = await import('./js/store.js'); const p = S.profiles()[0]; L.ensureUnits(p); const u = L.currentUnit(p); return { units: p.units, current: u && u.chars.join(''), level: u && L.unitLevel(p,u), kaRowOpen: L.rowUnlocked(p,1), fresh: L.newCharsForSession(p), trophies: p.trophies, coins: p.coins }; })()")
        print(json.dumps(st, ensure_ascii=False)); print('errors', errs)
        await b.close()
asyncio.run(main())
