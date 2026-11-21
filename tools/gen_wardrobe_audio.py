# Mochi says the name of each wardrobe item (and two try-on lines).
import json, re, sys, subprocess
sys.argv = ['x']
src = open('/home/claude/tools/gen_audio.py').read().split("for c in data['kana']:")[0]
exec(src)
js = open('/home/claude/hiragana-quest/js/wardrobe.js').read()
items = re.findall(r"\{ id: '([a-z]-[a-z]+)', cat: '\w+', name: '([^']+)'", js)
for iid, name in items:
    wav, k = synth(name.replace(' ', ''), MOCHI, speed=0.95, inton=1.2)
    save(wav, f"{OUT}/wardrobe/{iid}.mp3"); print(iid, name, k)
for vid, t in [('kawaii', 'かわいい！'), ('niau', 'にあうね！'), ('koban', 'こばん')]:
    wav, k = synth(t, MOCHI, speed=1.0, inton=1.3)
    save(wav, f"{OUT}/voice/{vid}.mp3"); print(vid, k)
