"""Generate an original documentary-style music bed (never the same twice: key, tempo, progression and texture come from the seed).
usage: python3 tools/synth_music.py <name> <seconds> [--seed N] [--mood calm|tense|epic]
Writes audio_lib/music/<name>.mp3 and logs it in audio_lib/CREDITS.json as original/synthesized (no license needed)."""
import numpy as np, soundfile as sf, os, json, sys, argparse, subprocess
from scipy.signal import butter, sosfilt
ap = argparse.ArgumentParser(); ap.add_argument('name'); ap.add_argument('seconds', type=float); ap.add_argument('--seed', type=int, default=None); ap.add_argument('--mood', default='calm'); a = ap.parse_args()
SR = 44100; rng = np.random.default_rng(a.seed); LIB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio_lib')
N = int(a.seconds * SR) + SR; out = np.zeros((N, 2))
key = rng.integers(0, 12); bpm = {'calm': rng.uniform(84, 96), 'tense': rng.uniform(96, 110), 'epic': rng.uniform(88, 100)}[a.mood]; beat = 60 / bpm
PROGS = {'calm': [[0, 3, 7], [8, 0, 3], [3, 7, 10], [10, 2, 5]], 'tense': [[0, 3, 7], [1, 5, 8], [0, 3, 7], [11, 2, 7]], 'epic': [[0, 3, 7], [8, 0, 3], [5, 8, 0], [7, 11, 2]]}
prog = PROGS[a.mood]; rng.shuffle(prog[1:])
f0 = lambda semi, octv: 110 * 2 ** ((key + semi) / 12 + octv)
lp = lambda x, f: sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
bar = 4 * beat
def pad(freqs, dur):
    t = np.arange(int(dur * SR)) / SR; x = sum(np.sin(2 * np.pi * f * t * d + rng.uniform(0, 6)) for f in freqs for d in (0.997, 1.0, 1.003)) / (3 * len(freqs))
    env = np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 1.0); return lp(x, 1800) * env
def pluck(f, dur):
    n = int(dur * SR); L = max(2, int(SR / f)); buf = rng.uniform(-1, 1, L); y = np.zeros(n)
    for i in range(n): y[i] = buf[i % L]; buf[i % L] = 0.5 * (buf[i % L] + buf[(i + 1) % L]) * 0.996
    return y
nb = int(a.seconds / bar) + 2
for b in range(nb):
    ch = prog[b % 4]; t0 = int(b * bar * SR)
    if t0 >= N: break
    seg = pad([f0(s, 1) for s in ch], bar + 0.8); e = min(N, t0 + len(seg)); out[t0:e, 0] += seg[:e - t0] * 0.55; out[t0:e, 1] += seg[:e - t0] * 0.55
    bs = lp(np.sin(2 * np.pi * f0(ch[0], -1) * np.arange(int(bar * SR)) / SR), 300) * np.exp(-np.arange(int(bar * SR)) / SR * 1.2); e = min(N, t0 + len(bs)); out[t0:e] += (bs[:e - t0] * 0.45)[:, None]
    if b >= 1:  # arpeggio from bar 2
        for k in range(8):
            if rng.random() < 0.15: continue
            s = ch[k % 3] + (12 if k >= 4 else 0); p = pluck(f0(s, 1), beat * 1.6) * 0.28; tk = t0 + int(k * beat / 2 * SR)
            if tk >= N: continue
            e = min(N, tk + len(p)); pan = 0.5 + 0.3 * np.sin(k)
            out[tk:e, 0] += p[:e - tk] * (1 - pan); out[tk:e, 1] += p[:e - tk] * pan
    if a.mood != 'calm' or b >= 4:  # soft pulse / shaker
        for k in range(8):
            tk = min(t0 + int(k * beat / 2 * SR), N - 1); n = int(0.06 * SR); sh = sosfilt(butter(2, 6000, 'high', fs=SR, output='sos'), rng.standard_normal(n)) * np.exp(-np.arange(n) / SR * 60) * (0.05 if k % 2 else 0.08); e = min(N, tk + n); out[tk:e] += sh[:e - tk, None]
        if a.mood != 'calm':
            for k in (0, 2):
                tk = min(t0 + int(k * beat * SR), N - 1); n = int(0.3 * SR); kk = np.sin(2 * np.pi * np.cumsum(60 * np.exp(-np.arange(n) / SR * 20) + 40) / SR) * np.exp(-np.arange(n) / SR * 9) * 0.5; e = min(N, tk + n); out[tk:e] += kk[:e - tk, None]
# simple stereo reverb
for d, g in [(0.031, 0.25), (0.047, 0.2), (0.071, 0.15), (0.113, 0.1)]:
    k = int(d * SR); out[k:, 0] += out[:-k, 1] * g; out[k:, 1] += out[:-k, 0] * g
out = out[:int(a.seconds * SR)]; f = int(2 * SR); out[-f:] *= np.linspace(1, 0, f)[:, None]; out[:int(0.5 * SR)] *= np.linspace(0, 1, int(0.5 * SR))[:, None]
out /= np.abs(out).max() / 0.8; os.makedirs(LIB + '/music', exist_ok=True); wav = LIB + f'/music/{a.name}.wav'; sf.write(wav, out, SR)
mp3 = wav[:-4] + '.mp3'; subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-b:a', '192k', mp3], check=True); os.remove(wav)
cp = LIB + '/CREDITS.json'; C = json.load(open(cp)) if os.path.exists(cp) else {}
C[os.path.basename(mp3)] = dict(title=f'{a.name} (generated)', creator='geo-kit synth', license='original, no attribution needed', source='tools/synth_music.py', seconds=a.seconds, category='music', used_in=None, seed=a.seed, mood=a.mood, key=int(key), bpm=round(bpm, 1))
json.dump(C, open(cp, 'w'), indent=1); print('music ->', mp3, f'key {key} bpm {bpm:.0f}')
