import sys, json, subprocess, os
from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile
D='/home/claude/dl'; OUT='/home/claude/hiragana-quest/audio'
ort = Onnxruntime.load_once(filename=f'{D}/voicevox_onnxruntime-linux-x64-1.17.3/lib/libvoicevox_onnxruntime.so.1.17.3')
syn = Synthesizer(ort, OpenJtalk(f'{D}/open_jtalk_dic_utf_8-1.11'))
with VoiceModelFile.open(f'{D}/0.vvm') as m: syn.load_voice_model(m)
TEACH, MOCHI = 2, 8
data = json.load(open('/home/claude/tools/content.json'))
def save(wav, path):
    tmp = '/tmp/x.wav'; open(tmp,'wb').write(wav)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',tmp,'-af','silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.08','-ac','1','-ar','24000','-b:a','48k',path],check=True)
def synth(text, style, speed=1.0, kana=False, pitch=0.0, inton=1.0):
    q = syn.create_audio_query_from_kana(text, style) if kana else syn.create_audio_query(text, style)
    if kana:
        # Single hiragana: hold the vowel a little (like a teacher saying it clearly)
        for p in q.accent_phrases:
            for m in p.moras: m.vowel_length = max(m.vowel_length, 0.5 if text=="ン'" else 0.42)
        q.pre_phoneme_length = 0.05; q.post_phoneme_length = 0.1
    q.speed_scale = speed; q.pitch_scale = pitch; q.intonation_scale = inton; q.volume_scale = 1.4
    return syn.synthesis(q, style), q.kana
for c in data['kana']:
    wav, k = synth(c['k'], TEACH, speed=0.9, kana=True)
    save(wav, f"{OUT}/kana/{c['r']}.mp3"); print(c['h'], k)
for c in ([] if 'kana-only' in sys.argv else data['kana']):
    wav, k = synth(c['wordText'], TEACH, speed=0.9)
    save(wav, f"{OUT}/words/{c['r']}.mp3"); print(c['word'], k)
for v in ([] if 'kana-only' in sys.argv else data['voice']):
    wav, k = synth(v['t'], MOCHI, speed=1.0, inton=1.3)
    save(wav, f"{OUT}/voice/{v['id']}.mp3"); print(v['id'], k)
