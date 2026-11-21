# The voice test page must open under the app's service worker (not bounce to the game).
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8771'], cwd='/home/claude/hiragana-quest', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); ctx = await b.new_context(); pg = await ctx.new_page()
        await pg.goto('http://localhost:8771/'); await pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=30000)
        await pg.goto('http://localhost:8771/voicetest/'); await pg.wait_for_timeout(1500)
        title = await pg.title()
        await pg.click('.row:nth-child(1) .play'); await pg.wait_for_timeout(1500)
        played = await pg.evaluate("[...document.querySelectorAll('audio')].length || 'html-audio'")
        ok = await pg.evaluate("fetch('audio/F-u.mp3').then(r => r.ok && r.headers.get('content-type'))")
        await ctx.set_offline(True); await pg.goto('http://localhost:8771/'); await pg.wait_for_timeout(800)
        game_offline = await pg.locator('.screen').count() > 0
        print('voice test page title:', title, '| audio file served:', ok, '| game still opens offline:', game_offline)
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
