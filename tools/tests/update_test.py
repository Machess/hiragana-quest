# Simulates GitHub Pages: serve a copy of the app, then publish new versions into it.
import asyncio, json, os, shutil, subprocess, time, re
from playwright.async_api import async_playwright
SRC='/home/claude/hiragana-quest'; SITE='/tmp/hq-site'; LOG='/tmp/hq-site.log'; PORT=8766
URL=f'http://localhost:{PORT}/'
def publish(note, touch=None, remove=None):
    if touch:
        with open(os.path.join(SITE, touch), 'a') as f: f.write(f'\n// change {time.time()}\n')
    open('/home/claude/tools/release-notes.txt','w').write(note)
    env=dict(os.environ, HQ_ROOT=SITE)
    out=subprocess.run(['python3','/home/claude/tools/build.py'],env=env,capture_output=True,text=True).stdout.strip()
    if remove: os.remove(os.path.join(SITE, remove))
    return json.load(open(os.path.join(SITE,'version.json')))['version']
def downloads():
    lines=open(LOG).read().splitlines()
    return [re.search(r'"GET (\S+)', l).group(1) for l in lines if '?v=' in l]
def clear_log(): open(LOG,'w').close()
STATE={'profiles':[{'id':'p1','name':'Yuki','avatar':'🐧','color':'#2a9d8f','chars':{},'trophies':{},'rowTrophies':{},'stamps':[],'mochiSpeed':5200,'bestStreak':0}],'settings':{'volume':1},'lastProfileId':'p1'}
async def running(pg): return await pg.evaluate("fetch('version.json').then(r=>r.json()).then(v=>v.version)")
async def main():
    shutil.rmtree(SITE, ignore_errors=True); shutil.copytree(SRC, SITE, ignore=shutil.ignore_patterns('tools'))
    v1=publish('Version one')
    srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd=SITE,stdout=subprocess.DEVNULL,stderr=open(LOG,'w'))
    time.sleep(1)
    errs=[]
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1280,'height':800})
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(URL); await pg.evaluate("s=>localStorage.setItem('hiraganaQuest.v1', JSON.stringify(s))", STATE)
            await pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=30000)
            t0=time.time(); await pg.reload(); await pg.wait_for_selector('.screen.home', timeout=15000)
            print(f'   normal online start: home shown after {time.time()-t0:.1f}s')
            print('1. first install      running', await running(pg), '(expected', v1+')')

            # --- 2. new version published; the app is opened again ---
            v2=publish('Sushi has new plates', touch='js/ui.js'); clear_log()
            panel_seen=[]
            pg.on('framenavigated', lambda f: None)
            await pg.reload()
            try:
                await pg.wait_for_selector('.upd-panel', timeout=8000); panel_seen.append(await pg.inner_text('.upd-text'))
            except Exception: pass
            await pg.wait_for_function(f"fetch('version.json').then(r=>r.json()).then(v=>v.version==='{v2}')", timeout=30000, polling=500)
            await pg.wait_for_selector('.screen.home', timeout=15000)
            await pg.wait_for_timeout(1200)
            toast=await pg.locator('.toast').all_inner_texts()
            print('2. update at start    running', await running(pg), '(expected', v2+')', '| panel said:', panel_seen, '| downloaded:', downloads(), '| welcome:', toast)

            # --- 3. update found while a game is in progress: must wait ---
            await pg.click('.adventure'); await pg.wait_for_selector('.view.meet', timeout=15000)
            v3=publish('Calmer goldfish', touch='js/learn.js'); clear_log()
            await pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
            await pg.wait_for_function("navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)", timeout=30000, polling=500)
            await pg.wait_for_timeout(3000)
            still=await pg.locator('.view.meet').count()==1
            print('3a. mid-game          still in the game:', still, '| running', await running(pg), '(should still be', v2+')')
            await pg.click('.game-top .icon-btn'); await pg.click('.modal .btn:not(.soft)')
            await pg.wait_for_function(f"fetch('version.json').then(r=>r.json()).then(v=>v.version==='{v3}')", timeout=30000, polling=500)
            await pg.wait_for_timeout(2500); await pg.wait_for_selector('.screen.home', timeout=15000)
            print('3b. back on home      running', await running(pg), '(expected', v3+')', '| downloaded:', downloads())

            # --- 4. no internet at start ---
            await ctx.set_offline(True)
            t0=time.time(); await pg.reload(); await pg.wait_for_selector('.screen.home', timeout=15000)
            print(f'4. offline start      home shown after {time.time()-t0:.1f}s, running', await running(pg), '| panel shown:', await pg.locator('.upd-panel').count()>0)
            await ctx.set_offline(False)

            # --- 5. a broken deploy (a changed file missing on the server) ---
            v4=publish('Broken', touch='js/session.js', remove='js/session.js'); clear_log()
            await pg.reload(); await pg.wait_for_selector('.screen.home', timeout=30000)
            await pg.wait_for_timeout(2500)
            ok=await pg.locator('.screen.home').count()==1
            print('5. broken deploy      running', await running(pg), '(should stay', v3+') | app still works:', ok)
            await b.close()
    finally:
        srv.terminate()
    print('page errors:', errs)
asyncio.run(main())
