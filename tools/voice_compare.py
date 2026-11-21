# Builds the listening comparison: the same 8 tricky sounds in several versions.
import subprocess, re, os, json, shutil
from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile
D = '/home/claude/dl'; OUT = '/home/claude/voicetest/audio'; GAME = '/home/claude/hiragana-quest/audio/kana'
ort = Onnxruntime.load_once(filename=f'{D}/voicevox_onnxruntime-linux-x64-1.17.3/lib/libvoicevox_onnxruntime.so.1.17.3')
syn = Synthesizer(ort, OpenJtalk(f'{D}/open_jtalk_dic_utf_8-1.11'))
for n in (0, 2, 13, 15, 21):
    with VoiceModelFile.open(f'{D}/{n}.vvm') as m: syn.load_voice_model(m)
SOUNDS = [('あ', 'a', 'ア'), ('い', 'i', 'イ'), ('う', 'u', 'ウ'), ('く', 'ku', 'ク'), ('す', 'su', 'ス'), ('つ', 'tsu', 'ツ'), ('し', 'shi', 'シ'), ('か', 'ka', 'カ')]
# row id, label, style id, mode
ROWS = [
  ('B', '四国めたん (now)', 2, 'natural'),
  ('C', '四国めたん (now)', 2, 'long'),
  ('D', '春日部つむぎ (Mochi)', 8, 'natural'),
  ('E', '雨晴はう', 10, 'natural'),
  ('F', '九州そら', 16, 'natural'),
  ('G', '東北きりたん', 108, 'natural'),
  ('H', 'もち子さん', 20, 'natural'),
  ('I', '春歌ナナ', 54, 'natural'),
]
def stat(path):
    o = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.search(r'mean_volume: (-?[\d.]+)', o).group(1)), float(re.search(r'max_volume: (-?[\d.]+)', o).group(1))
def clean(wav_bytes, out):
    # Clean volume: trim silence, tiny fades, then plain gain to a common loudness.
    # A gentle limiter only catches stray peaks. No compression, no treble boost.
    tmp = '/tmp/vc.wav'; open(tmp, 'wb').write(wav_bytes)
    trimmed = '/tmp/vc_t.wav'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-af',
      'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,highpass=f=60,afade=t=in:d=0.008,areverse,afade=t=in:d=0.03,areverse,apad=pad_dur=0.1',
      trimmed], check=True)
    mean, peak = stat(trimmed)
    gain = min(-15.5 - mean, -1.0 - peak + 3.0)  # aim for game loudness, never push peaks more than 3 dB into the limiter
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', trimmed, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.89:attack=5:release=60:level=false',
      '-ac', '1', '-ar', '24000', '-b:a', '96k', out], check=True)
manifest = {'sounds': [s[0] for s in SOUNDS], 'rows': [{'id': 'A', 'label': '四国めたん — what the game uses now', 'files': []}]}
for h, r, k in SOUNDS:
    shutil.copy(f'{GAME}/{r}.mp3', f'{OUT}/A-{r}.mp3'); manifest['rows'][0]['files'].append(f'audio/A-{r}.mp3')
for rid, label, style, mode in ROWS:
    files = []
    for h, r, k in SOUNDS:
        q = syn.create_audio_query_from_kana(f"{k}'", style)
        q.speed_scale = 0.72 if mode == 'long' else 0.95  # 'long': the whole syllable a little slower, evenly
        q.speed_scale = q.speed_scale; q.pre_phoneme_length = 0.05; q.post_phoneme_length = 0.1
        clean(syn.synthesis(q, style), f'{OUT}/{rid}-{r}.mp3'); files.append(f'audio/{rid}-{r}.mp3')
    desc = {'natural': 'natural length, clean volume', 'long': 'a little slower, clean volume'}[mode]
    manifest['rows'].append({'id': rid, 'label': f'{label} — {desc}', 'files': files})
json.dump(manifest, open('/home/claude/voicetest/manifest.json', 'w'), ensure_ascii=False, indent=1)
print(len(manifest['rows']), 'versions x', len(SOUNDS), 'sounds')
