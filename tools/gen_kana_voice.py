# The 46 single-hiragana sounds: 春日部つむぎ (style 8), natural length, clean volume.
# (Chosen by ear on the voice test, Nov 2026. Stretching vowels and heavy compression made
#  the earlier version sound raspy, so: no stretching, no compression, no treble boost.)
import json, sys, importlib.util
spec = importlib.util.spec_from_file_location('vc', '/home/claude/tools/voice_compare.py')
src = open('/home/claude/tools/voice_compare.py').read()
head = src[:src.index('manifest = {')]          # engine setup + clean() only
exec(head)
STYLE = 8
data = json.load(open('/home/claude/tools/content.json'))
for c in data['kana']:
    q = syn.create_audio_query_from_kana(c['k'], STYLE)
    q.speed_scale = 0.95; q.pre_phoneme_length = 0.05; q.post_phoneme_length = 0.1
    clean(syn.synthesis(q, STYLE), f"/home/claude/hiragana-quest/audio/kana/{c['r']}.mp3")
    print(c['h'], q.kana, end='  ')
print()
