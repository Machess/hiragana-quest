# Renders icons and writes sw.js with the precache list + content hash version.
import hashlib, os, json, sys, asyncio
ROOT=os.environ.get('HQ_ROOT', '/home/claude/hiragana-quest')
def icons():
    from playwright.sync_api import sync_playwright
    import subprocess
    mochi = subprocess.run(['node','--input-type=module','-e',
      "import('/home/claude/hiragana-quest/js/ui.js').catch(()=>{});"],capture_output=True)
    src=open(f'{ROOT}/js/ui.js').read()
    start=src.index('return `<svg viewBox="0 0 120 120"'); end=src.index('</svg>`;',start)+6
    svg=src[start+8:end]
    # resolve template pieces for idle-happy face
    import re
    svg=svg.replace('${eyes}','<path d="M38 60 q6 -8 12 0 M70 60 q6 -8 12 0" stroke="#3b3355" stroke-width="3.5" fill="none" stroke-linecap="round"/>')
    svg=svg.replace('${mouth}','<path d="M53 70 q7 9 14 0 z" fill="#c8506a"/>')
    svg=re.sub(r"\$\{mood === 'sleepy'.*?: ''\}",'',svg,flags=re.S)
    with sync_playwright() as p:
        b=p.chromium.launch(); pg=b.new_page()
        for name,size,pad in [('icon-192',192,0.08),('icon-512',512,0.08),('icon-maskable-512',512,0.2)]:
            inner=size*(1-2*pad)
            html=f'''<html><body style="margin:0;width:{size}px;height:{size}px;background:#f7f1e3;display:grid;place-items:center">
            <div style="width:{inner}px;height:{inner}px;position:relative">{svg.replace('class="mochi-svg"','style="width:100%;height:100%"')}
            <div style="position:absolute;right:-2%;bottom:-2%;width:38%;height:38%;border-radius:50%;background:#e4572e;color:#fff;display:grid;place-items:center;font:600 {inner*0.24}px 'Klee One';">あ</div></div>
            <style>@font-face{{font-family:'Klee One';src:url(file://{ROOT}/fonts/klee.woff2)}}</style></body></html>'''
            pg.set_viewport_size({'width':size,'height':size}); pg.set_content(html); pg.wait_for_timeout(300)
            pg.screenshot(path=f'{ROOT}/icons/{name}.png')
        b.close()
def sw():
    import datetime
    skip_dirs = ('tools', '.')
    skip = {'sw.js', 'README.md', 'version.json', '.gitignore'}
    files = []
    for d, dirs, fs in os.walk(ROOT):
        dirs[:] = [x for x in dirs if not x.startswith('.') and x != 'tools']
        for f in fs:
            rel = os.path.relpath(os.path.join(d, f), ROOT)
            if rel.startswith(skip_dirs) or rel in skip or rel.endswith(('.zip', '.tmp.mp3')): continue
            files.append(rel)
    files.sort()
    fp = lambda rel: hashlib.sha1(open(os.path.join(ROOT, rel), 'rb').read()).hexdigest()[:12]
    hashes = {f: fp(f) for f in files}
    tpl = open(os.path.join(os.path.dirname(__file__), 'sw.template.js')).read()
    # The version covers every app file AND the service worker code itself.
    ver = hashlib.sha1((json.dumps(hashes, sort_keys=True) + tpl).encode()).hexdigest()[:10]
    # version.json: what the grown-ups screen shows, and the notes for this release
    notes_file = os.path.join(os.path.dirname(__file__), 'release-notes.txt')
    notes = open(notes_file).read().strip() if os.path.exists(notes_file) else ''
    old = {}
    vpath = os.path.join(ROOT, 'version.json')
    if os.path.exists(vpath):
        try: old = json.load(open(vpath))
        except Exception: old = {}
    built = old.get('built') if old.get('version') == ver else datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    json.dump({'version': ver, 'built': built, 'notes': notes}, open(vpath, 'w'), ensure_ascii=False, indent=1)
    hashes['version.json'] = fp('version.json')
    hashes['./'] = hashes['index.html']
    out = tpl.replace('__VERSION__', ver).replace('__FILES__', json.dumps(hashes, indent=1, sort_keys=True))
    open(f'{ROOT}/sw.js', 'w').write(out)
    print('sw version', ver, len(hashes), 'files')
if 'icons' in sys.argv: icons()
sw()
