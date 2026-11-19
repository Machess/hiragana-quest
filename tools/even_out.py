# Second pass: bring quiet-sounding clips (い, う…) up to the same average level, peaks held by a limiter.
import subprocess, re, glob, os
ROOT = '/home/claude/hiragana-quest/audio'
TARGET = -14.5
def mean(path):
    out = subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',path,'-af','volumedetect','-f','null','-'],capture_output=True,text=True).stderr
    return float(re.search(r'mean_volume: (-?[\d.]+) dB', out).group(1))
n = 0
for f in sorted(glob.glob(f'{ROOT}/*/*.mp3')):
    m = mean(f)
    if m < TARGET - 0.5:
        g = min(TARGET - m, 6)
        tmp = f + '.tmp.mp3'
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f,'-af',f'volume={g:.2f}dB,alimiter=limit=0.89:attack=1:release=40:level=false','-ac','1','-ar','24000','-b:a','64k',tmp],check=True)
        os.replace(tmp, f); n += 1
print(n, 'clips raised')
