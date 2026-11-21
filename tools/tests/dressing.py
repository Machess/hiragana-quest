import asyncio
from playwright.async_api import async_playwright
STATE={'profiles':[{'id':'p1','name':'Yuki','avatar':'🐧','color':'#2a9d8f','chars':{'あ':{'intro':1,'step':5,'prog':0,'hear':.6,'read':.5,'write':.4,'last':0,'seen':9,'cnt':{}},'か':{'intro':1,'step':3,'prog':0,'hear':.3,'read':0,'write':.3,'last':0,'seen':5,'cnt':{}},'さ':{'intro':1,'step':2,'prog':0,'hear':.2,'read':0,'write':.2,'last':0,'seen':3,'cnt':{}},'く':{'intro':1,'step':2,'prog':0,'hear':.2,'read':0,'write':.2,'last':0,'seen':3,'cnt':{}},'ら':{'intro':1,'step':2,'prog':0,'hear':.2,'read':0,'write':.2,'last':0,'seen':3,'cnt':{}}},'trophies':{},'rowTrophies':{},'stamps':[],'mochiSpeed':5200,'bestStreak':0,'coins':95,'coinProg':2,'owned':[],'look':{}},
                       {'id':'p2','name':'Ren','avatar':'🦊','color':'#e4572e','chars':{},'trophies':{},'rowTrophies':{},'stamps':[],'mochiSpeed':5200,'bestStreak':0,'coins':0,'owned':['c-sakura','h-straw'],'look':{'color':'c-sakura','hat':'h-straw'}}],
       'settings':{'volume':1},'lastProfileId':None}
async def main():
    errs=[]
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1280,'height':800}, device_scale_factor=1.5); pg=await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
        await pg.goto('http://localhost:8765/'); await pg.evaluate("s=>localStorage.setItem('hiraganaQuest.v1', JSON.stringify(s))", STATE)
        await pg.reload(); await pg.wait_for_timeout(1200); await pg.screenshot(path='/home/claude/test/shots/d-profiles.png')
        await pg.click('text=Yuki'); await pg.wait_for_timeout(800)
        await pg.click('text=Dressing Room'); await pg.wait_for_timeout(800); await pg.screenshot(path='/home/claude/test/shots/d-room-colours.png')
        # try on and buy a colour
        await pg.locator('.dr-card[data-id="c-kinako"]').dispatch_event('pointerdown'); await pg.wait_for_timeout(500)
        await pg.click('.btn.buy'); await pg.wait_for_timeout(400); await pg.screenshot(path='/home/claude/test/shots/d-confirm.png')
        await pg.click('.modal .btn:not(.soft)'); await pg.wait_for_timeout(1500)
        # hats: buy fox mask (60), then too expensive kabuto -> save for it
        await pg.click('.dr-tab:has-text("Hats")'); await pg.wait_for_timeout(300)
        await pg.locator('.dr-card[data-id="h-hachimaki"]').dispatch_event('pointerdown'); await pg.click('.btn.buy'); await pg.click('.modal .btn:not(.soft)'); await pg.wait_for_timeout(800)
        await pg.locator('.dr-card[data-id="h-kabuto"]').dispatch_event('pointerdown'); await pg.wait_for_timeout(600)
        await pg.click('text=Save for this'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/home/claude/test/shots/d-room-hats.png')
        for tab, ids in [('Items', ['i-onigiri','i-uchiwa','i-fude','i-kasa','i-chochin']), ('Reactions', ['r-sparkle']), ('Celebrations', ['e-cranes'])]:
            await pg.click(f'.dr-tab:has-text("{tab}")'); await pg.wait_for_timeout(300)
            await pg.locator(f'.dr-card[data-id="{ids[-1]}"]').dispatch_event('pointerdown'); await pg.wait_for_timeout(450)
            await pg.screenshot(path=f'/home/claude/test/shots/d-room-{tab.split()[0].lower()}.png')
        st = await pg.evaluate("JSON.parse(localStorage.getItem('hiraganaQuest.v1')).profiles[0]")
        print('coins left', st['coins'], '| owned', st['owned'], '| look', st['look'], '| wish', st['wish'])
        await pg.click('.back'); await pg.wait_for_timeout(700); await pg.screenshot(path='/home/claude/test/shots/d-home.png')
        await b.close()
    print('errors', errs)
asyncio.run(main())
