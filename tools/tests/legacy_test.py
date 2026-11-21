# The tablet today runs the old version (commit d2f1c21). Publish the new one and open the app twice.
import asyncio, json, os, shutil, subprocess, time
from playwright.async_api import async_playwright
SITE='/tmp/hq-legacy'; PORT=8767; URL=f'http://localhost:{PORT}/'
shutil.rmtree(SITE, ignore_errors=True)
subprocess.run(['git','-C','/home/claude/hq-repo','worktree','add','-f','--detach',SITE,'d2f1c21'],capture_output=True)
srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd=SITE,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
STATE={'profiles':[{'id':'p1','name':'Yuki','avatar':'🐧','color':'#2a9d8f','chars':{},'trophies':{},'rowTrophies':{},'stamps':[],'mochiSpeed':5200,'bestStreak':0}],'settings':{'volume':1},'lastProfileId':'p1'}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1280,'height':800}); pg=await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.evaluate("s=>localStorage.setItem('hiraganaQuest.v1', JSON.stringify(s))", STATE)
        await pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=30000)
        await pg.reload(); await pg.wait_for_selector('.screen.home', timeout=15000)
        has_old = await pg.evaluate("fetch('version.json').then(r=>r.ok)")
        print('old version running (no version.json):', not has_old)
        # publish the new version over it
        for item in os.listdir('/home/claude/hiragana-quest'):
            if item == 'tools': continue
            s=os.path.join('/home/claude/hiragana-quest',item); d=os.path.join(SITE,item)
            if os.path.isdir(s): shutil.copytree(s,d,dirs_exist_ok=True)
            else: shutil.copy2(s,d)
        for n in (1, 2):
            await pg.reload(); await pg.wait_for_selector('.screen.home', timeout=30000); await pg.wait_for_timeout(2500)
            v = await pg.evaluate("fetch('version.json').then(r=>r.ok?r.json():null).then(v=>v&&v.version)")
            newcode = await pg.evaluate("import('./js/update.js').then(()=>true).catch(()=>false)")
            print(f'open #{n}: running version', v, '| new update code present:', newcode, '| profile kept:', await pg.locator('.who').inner_text())
        await b.close()
    print('page errors:', errs)
try: asyncio.run(main())
finally:
    srv.terminate(); subprocess.run(['git','-C','/home/claude/hq-repo','worktree','remove','--force',SITE],capture_output=True)
