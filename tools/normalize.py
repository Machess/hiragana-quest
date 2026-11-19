# Make every speech clip equally loud and clear on small tablet speakers:
# cut rumble, lift speech presence, gently compress, then raise to -1 dBFS peak.
import subprocess, re, glob, os, sys
ROOT = '/home/claude/hiragana-quest/audio'
CHAIN = 'highpass=f=110,equalizer=f=2800:t=q:w=1.2:g=3,acompressor=threshold=-28dB:ratio=4:attack=2:release=80:makeup=2'
def peak(path, chain):
    out = subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',path,'-af',chain+',volumedetect','-f','null','-'],capture_output=True,text=True).stderr
    return float(re.search(r'max_volume: (-?[\d.]+) dB', out).group(1))
files = sorted(glob.glob(f'{ROOT}/*/*.mp3'))
for f in files:
    gain = -1.0 - peak(f, CHAIN)
    tmp = f + '.tmp.mp3'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f,'-af',f'{CHAIN},volume={gain:.2f}dB,alimiter=limit=0.89:level=false','-ac','1','-ar','24000','-b:a','64k',tmp],check=True)
    os.replace(tmp, f)
print(len(files), 'files levelled')
