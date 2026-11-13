"""Study pipeline for one reference video.
usage: python3 study.py <video.mp4> <slug>
Outputs into studies/<slug>/: words.json, p1/ (5 fps timestamped sheets),
perframe.json (every frame: diff, camera scale/rot/translate, residual local motion),
audio.txt (loudness + silences), meta.json
"""
import sys, os, json, subprocess, cv2, numpy as np

src, slug = sys.argv[1], sys.argv[2]
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'studies', slug)
os.makedirs(os.path.join(root, 'p1'), exist_ok=True)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
def sh(c): return subprocess.run(c, shell=True, capture_output=True, text=True)

# meta
p = json.loads(sh(f'ffprobe -v error -print_format json -show_format -show_streams "{src}"').stdout)
v = [s for s in p['streams'] if s['codec_type'] == 'video'][0]
meta = dict(w=v['width'], h=v['height'], fps=v['r_frame_rate'], dur=float(p['format']['duration']))
json.dump(meta, open(f'{root}/meta.json', 'w'))

# pass-1 sheets
sh(f'ffmpeg -v error -y -i "{src}" -vf "fps=5,scale=240:-1,drawtext=fontfile={FONT}:text=\'%{{pts\\:hms}}\':x=4:y=4:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.7,tile=6x3" {root}/p1/s%02d.jpg')

# audio
sh(f'ffmpeg -v error -y -i "{src}" -ac 1 -ar 16000 -f f32le {root}/a.f32')
lo = sh(f'ffmpeg -nostats -i "{src}" -af ebur128 -f null - 2>&1 | grep -A6 "Summary"').stdout
si = sh(f'ffmpeg -nostats -i "{src}" -af silencedetect=n=-35dB:d=0.25 -f null - 2>&1 | grep silence_').stdout
open(f'{root}/audio.txt', 'w').write(lo + '\n' + si)

# transcript
from faster_whisper import WhisperModel
a = np.fromfile(f'{root}/a.f32', dtype=np.float32)
seg, _ = WhisperModel('small.en', compute_type='int8').transcribe(a, word_timestamps=True)
W = [[round(w.start, 2), round(w.end, 2), w.word.strip()] for s in seg for w in s.words]
json.dump(W, open(f'{root}/words.json', 'w'))
os.remove(f'{root}/a.f32')

# per-frame camera + motion
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS); prev = None; out = []; i = 0
while True:
    ok, f = cap.read()
    if not ok: break
    g = cv2.cvtColor(cv2.resize(f, (270, 480)), cv2.COLOR_BGR2GRAY).astype(np.float32)
    if prev is not None:
        d = dict(f=i, t=round(i / fps, 3), diff=round(float(np.mean(np.abs(g - prev))), 2))
        try:
            _, wm = cv2.findTransformECC(prev, g, np.eye(2, 3, dtype=np.float32), cv2.MOTION_AFFINE,
                                         (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 1e-4), None, 1)
            al = cv2.warpAffine(prev, wm, (270, 480))
            d.update(scale=round(float(np.sqrt(abs(np.linalg.det(wm[:, :2])))), 4),
                     rot=round(float(np.degrees(np.arctan2(wm[1, 0], wm[0, 0]))), 3),
                     tx=round(float(wm[0, 2]) * 4, 1), ty=round(float(wm[1, 2]) * 4, 1),
                     resid=round(float(np.mean(np.abs(g[20:-20, 20:-20] - al[20:-20, 20:-20]))), 2))
        except cv2.error:
            pass
        out.append(d)
    prev = g; i += 1
json.dump(out, open(f'{root}/perframe.json', 'w'))
print(slug, meta, len(W), 'words', i, 'frames')
