# The 46 single-hiragana sounds: 春日部つむぎ (style 8), clean volume, no compression.
# v2 (Nov 2026), after "か and こ aren't good, え and け sound too similar":
#  - every vowel is held to about the same length, ~0.3 s (at most 1.8x stretch)
#    (the voice model clipped lone syllables to ~0.1 s of full voice, so か/こ sounded cut off)
#  - k/t/h/f consonants: slightly longer, and the consonant itself is made 6 dB louder
#    (consonant-vowel ratio boost, a standard speech-clarity technique) so け ≠ え
#  - the start of each file is no longer faded in, which had been softening the consonant
import json, subprocess, io, wave, sys
import numpy as np
from scipy.signal import butter, sosfilt
src = open('/home/claude/tools/voice_compare.py').read()
exec(src[:src.index('def clean(')])            # engine setup + stat()
STYLE, SPEED, PRE, POST = 8, 0.95, 0.10, 0.12
SR, HOP, FPS = 24000, 256, 24000 / 256
VOWEL = 0.30                                     # seconds of vowel in the query
BOOST = {'k': 6.0, 't': 6.0, 'h': 6.0, 'f': 6.0, 'r': 4.0, 'w': 3.0}  # dB on the consonant
MIN_CONS = {'k': 0.06, 't': 0.05, 'r': 0.055, 'w': 0.07}  # w: was 11 ms, わ sounded like あ   # r: the tongue tap was ~20 ms and vanished (り sounded like い)
EXTRA = {'コ': 4.0}                              # こ's k sits low before o: a bit more
OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/hiragana-quest/audio/kana'

def frames(sec): return int(round(sec / SPEED * FPS))
def to_np(b):
    w = wave.open(io.BytesIO(b)); return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
LOW = butter(4, 900, 'low', fs=SR, output='sos')
def steady(x):
    lo = sosfilt(LOW, x); w = int(0.01 * SR); n = len(lo) // w
    e = 20 * np.log10(np.sqrt(np.mean(lo[:n * w].reshape(n, w) ** 2, axis=1)) + 1e-9)
    return (e > e.max() - 12).sum() * 0.01

def synth(kana):
    base_q = syn.create_audio_query_from_kana(kana, STYLE)
    m0 = base_q.accent_phrases[0].moras[0]
    c, cl0, vl0 = m0.consonant, m0.consonant_length or 0.0, m0.vowel_length
    # Hold every vowel to about the same length (0.30 s as written in the query, i.e. ~0.32 s spoken),
    # never stretching more than 1.8x, so all 46 sounds feel equally calm and none is clipped.
    f = float(np.clip(VOWEL / vl0, 1.0, 1.8))
    q = syn.create_audio_query_from_kana(kana, STYLE)
    q.speed_scale, q.pre_phoneme_length, q.post_phoneme_length = SPEED, PRE, POST
    m = q.accent_phrases[0].moras[0]
    if c in MIN_CONS: m.consonant_length = max(cl0, MIN_CONS[c])
    m.vowel_length = vl0 * f
    x = to_np(syn.synthesis(q, STYLE)); s = steady(x)
    info = dict(c=c, cl=m.consonant_length or 0, f=round(f, 2), steady=round(s, 2))
    if c in BOOST:
        a = frames(PRE) * HOP; b = a + frames(m.consonant_length) * HOP
        a = max(0, a - int(0.01 * SR))                  # catch the very start of the burst
        g = np.ones_like(x); up = 10 ** ((BOOST[c] + EXTRA.get(kana[0], 0)) / 20); r = int(0.005 * SR)
        g[a:b] = up
        g[a - r:a] = np.linspace(1, up, r); g[b:b + r] = np.linspace(up, 1, r)  # 5 ms ramps
        x = x * g
    return x, info

def clean(x, out):
    # trim: keep 15 ms before the first sound, no fade on the start (protects the consonant)
    e = np.abs(x); thr = 10 ** (-55 / 20)
    i0 = max(0, int(np.argmax(e > thr)) - int(0.015 * SR))
    w = int(0.01 * SR); n = len(x) // w
    lv = 20 * np.log10(np.sqrt(np.mean(x[:n * w].reshape(n, w) ** 2, axis=1)) + 1e-9)
    last = int(np.nonzero(lv > lv.max() - 20)[0][-1])           # last 10 ms block within 20 dB of the peak
    i1 = min(len(x) - int(np.argmax(e[::-1] > thr)) + int(0.02 * SR), (last + 1) * w + int(0.09 * SR))
    y = x[i0:min(i1, len(x))].copy()
    r = int(0.002 * SR); y[:r] *= np.linspace(0, 1, r)        # 2 ms click guard only
    t = int(0.07 * SR); y[-t:] *= np.linspace(1, 0, t) ** 2    # gentle tail
    y = np.concatenate([y, np.zeros(int(0.1 * SR), np.float32)])
    tmp = '/tmp/kv.wav'
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-af', 'highpass=f=60', '/tmp/kv2.wav'], check=True)
    mean, peak = stat('/tmp/kv2.wav')
    gain = min(-15.5 - mean, -1.0 - peak + 3.0)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', '/tmp/kv2.wav', '-af',
      f'volume={gain:.2f}dB,alimiter=limit=0.89:attack=5:release=60:level=false',
      '-ac', '1', '-ar', '24000', '-b:a', '96k', out], check=True)

if __name__ == '__main__':
    data = json.load(open('/home/claude/tools/content.json'))
    only = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None
    for k in data['kana']:
        if only and k['r'] not in only: continue
        x, info = synth(k['k'])
        clean(x, f"{OUT}/{k['r']}.mp3")
        print(k['h'], info)
