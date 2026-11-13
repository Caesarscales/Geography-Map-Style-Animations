"""Style + camera QA: compare a rendered video against the reference library.
usage: python3 tools/qa.py <our_video.mp4> [out_dir]
Writes <out_dir>/qa_report.md and <out_dir>/qa_sheet.jpg (our frames vs closest reference frames).
Pass ranges come from the 7 house-style reference videos (studies/allstats.json) with a small margin.
"""
import sys, os, json, glob, cv2, numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
HOUSE = ['colombia', 'oman', 'slavetrade', 'gambia', 'uboats', 'stan', 'italy']
src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(src)); os.makedirs(out, exist_ok=True)

def measure(path):
    cap = cv2.VideoCapture(path); fps = cap.get(cv2.CAP_PROP_FPS) or 30; prev = None; rows = []; hsv = []; i = 0
    while True:
        ok, f = cap.read()
        if not ok: break
        small = cv2.resize(f, (270, 480)); g = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32)
        if i % int(round(fps)) == 0: hsv.append(cv2.cvtColor(small, cv2.COLOR_BGR2HSV).reshape(-1, 3).mean(0))
        if prev is not None:
            d = float(np.mean(np.abs(g - prev))); r = dict(diff=d, cam=0.0, zoom=0.0, rot=0.0)
            try:
                _, w = cv2.findTransformECC(prev, g, np.eye(2, 3, dtype=np.float32), cv2.MOTION_AFFINE, (3, 40, 1e-4), None, 1)
                r.update(cam=float(np.hypot(w[0, 2], w[1, 2]) * 4), zoom=float((np.sqrt(abs(np.linalg.det(w[:2, :2]))) - 1) * 100), rot=float(np.degrees(np.arctan2(w[1, 0], w[0, 0]))))
            except cv2.error: pass
            rows.append(r)
        prev = g; i += 1
    k = 30 / fps  # normalise to 30 fps
    d = np.array([r['diff'] for r in rows]); cam = np.array([r['cam'] for r in rows]) / k if k else 0; zoom = np.array([r['zoom'] for r in rows]) / k
    if fps > 40 and (d[0::2] < 0.05).mean() > 0.5: d, cam, zoom = d[1::2], cam[1::2] * 1, zoom[1::2]  # doubled-frame 60fps
    moving = (cam > 0.5) | (np.abs(zoom) > 0.05); still = d * (30 / min(fps, 30)) < 0.3
    runs = 0; c = 0
    for s in still:
        c = c + 1 if s else 0
        if c == 4: runs += 1
    speed = cam + np.abs(zoom) * 20; jerk = np.abs(np.diff(speed))
    H = np.array(hsv)
    return dict(cam_moving=100 * moving.mean(), still=100 * still.mean(), still_runs=runs, diff_med=float(np.median(d)),
                cam_med=float(np.median(cam)), cam_p95=float(np.percentile(cam, 95)), zoom_p95=float(np.percentile(np.abs(zoom), 95)),
                zin=100 * (zoom > 0.05).mean(), zout=100 * (zoom < -0.05).mean(), jerk_p95=float(np.percentile(jerk, 95)),
                hard_cuts=int(((d[1:] > 45) & (d[:-1] <= 45)).sum()), sat=float(H[:, 1].mean()), val=float(H[:, 2].mean()))

# reference ranges (cached)
cache = os.path.join(ROOT, 'reference', 'ref_metrics.json')
if os.path.exists(cache): REF = json.load(open(cache))
else:
    REF = {}
    vids = json.load(open(os.path.join(ROOT, 'reference', 'videos.json')))
    for k in HOUSE:
        if k in vids and os.path.exists(vids[k]): print('measuring reference', k); REF[k] = measure(vids[k])
    json.dump(REF, open(cache, 'w'), indent=1)

ours = measure(src)
lines = ['# Style & camera QA', '', f'Video: `{os.path.basename(src)}`', '', '| metric | ours | reference range | result |', '|---|---|---|---|']
fails = 0
for m, v in ours.items():
    vals = [r[m] for r in REF.values()]; lo, hi = min(vals), max(vals); pad = max((hi - lo) * 0.15, abs(hi) * 0.05, 0.5)
    if m in ('still', 'still_runs', 'hard_cuts'): lo = 0
    ok = lo - pad <= v <= hi + pad; fails += not ok
    lines.append(f'| {m} | {v:.2f} | {lo:.2f} – {hi:.2f} | {"PASS" if ok else "**FAIL**"} |')
lines += ['', f'**{fails} metric(s) outside the reference range.**' if fails else '**All metrics inside the reference range.**']

# visual sheet: 8 of our frames vs nearest reference frame (colour histogram)
def hist(img):
    h = cv2.calcHist([cv2.cvtColor(img, cv2.COLOR_BGR2HSV)], [0, 1], None, [30, 16], [0, 180, 0, 256]); return cv2.normalize(h, h).flatten()
refs = sorted(glob.glob(os.path.join(ROOT, 'reference', 'frames', '*', '*.jpg'))); RH = [hist(cv2.imread(p)) for p in refs]
cap = cv2.VideoCapture(src); n = int(cap.get(7)); S = Image.new('RGB', (8 * 240, 2 * 427 + 30), 'white'); dr = ImageDraw.Draw(S)
for j, fr in enumerate(np.linspace(n * 0.05, n * 0.95, 8).astype(int)):
    cap.set(1, fr); ok, im = cap.read()
    if not ok: continue
    h = hist(cv2.resize(im, (360, 640))); best = int(np.argmax([cv2.compareHist(h, r, cv2.HISTCMP_CORREL) for r in RH]))
    S.paste(Image.fromarray(im[:, :, ::-1]).resize((240, 427)), (j * 240, 0)); S.paste(Image.open(refs[best]).resize((240, 427)), (j * 240, 427))
    dr.text((j * 240 + 4, 2 * 427 + 6), os.path.relpath(refs[best], os.path.join(ROOT, 'reference', 'frames'))[:34], fill='black')
S.save(os.path.join(out, 'qa_sheet.jpg'), quality=85)
lines += ['', '`qa_sheet.jpg`: top row = ours, bottom row = closest reference frame in look. Compare map colours, texture, sticker size and text.']
open(os.path.join(out, 'qa_report.md'), 'w').write('\n'.join(lines)); print('\n'.join(lines))
