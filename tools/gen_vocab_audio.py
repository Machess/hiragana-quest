import json, sys
sys.argv=['x']
src=open('/home/claude/tools/gen_audio.py').read().split("for c in data['kana']:")[0]
exec(src)
import os
os.makedirs(f'{OUT}/vocab', exist_ok=True)
for w in json.load(open('/home/claude/tools/vocab.json')):
    wav, k = synth(w['tts'], TEACH, speed=0.9)
    save(wav, f"{OUT}/vocab/{w['id']}.mp3"); print(w['w'], k)
for vid, t in [('arigatou','ありがとう！'),('oishii','おいしい！'),('tsuita','ついた！'),('mitsuketa','みつけた！'),('dorenooto','どの おとかな？'),('chigau','ちがうの、どれ？')]:
    wav, k = synth(t, MOCHI, speed=1.0, inton=1.3)
    save(wav, f"{OUT}/voice/{vid}.mp3"); print(vid, k)
