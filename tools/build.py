# Renders icons and writes sw.js with the precache list + content hash version.
import hashlib, os, json, sys, asyncio
ROOT='/home/claude/hiragana-quest'
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
    files=[]
    for d,_,fs in os.walk(ROOT):
        for f in fs:
            rel=os.path.relpath(os.path.join(d,f),ROOT)
            if rel.startswith(('tools','.')) or rel in ('sw.js','README.md') or rel.endswith('.zip'): continue
            files.append(rel)
    files.sort()
    h=hashlib.sha1()
    for f in files: h.update(open(os.path.join(ROOT,f),'rb').read())
    ver=h.hexdigest()[:10]
    tpl=open('/home/claude/tools/sw.template.js').read()
    open(f'{ROOT}/sw.js','w').write(tpl.replace('__VERSION__',ver).replace('__FILES__',json.dumps(['./']+files,indent=1)))
    print('sw version',ver,len(files),'files')
if 'icons' in sys.argv: icons()
sw()
