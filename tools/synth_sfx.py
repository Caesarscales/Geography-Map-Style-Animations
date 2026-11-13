"""Synthesize the base SFX kit (procedural, no licensing issues). Real Openverse files in audio_lib/sfx take priority when present."""
import numpy as np, os, soundfile as sf
from scipy.signal import butter, sosfilt
SR = 44100; OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio_lib', 'synth'); os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)
T = lambda d: np.arange(int(SR * d)) / SR
def env(n, a, d, curve=4): t = np.linspace(0, 1, n); e = np.minimum(t / max(a, 1e-4), 1) * np.exp(-curve * t / d); return e
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def norm(x, peak=0.89): x = x - x.mean(); return x / (np.abs(x).max() + 1e-9) * peak
def save(name, x, stereo_w=0.15):
    x = norm(x); d = int(SR * 0.012 * stereo_w); L = x; R = np.concatenate([np.zeros(d), x[:len(x) - d]]) if d else x
    f = np.minimum(1, np.linspace(len(x) / (SR * 0.01), 0, len(x))) ; sf.write(os.path.join(OUT, name + '.wav'), np.stack([L * f, R * f], 1), SR)
for v in range(4):  # pop: pitch-dropping bubble + click
    t = T(0.16); f0 = 900 + 250 * v; ph = 2 * np.pi * np.cumsum(f0 * np.exp(-t * 28) + 220) / SR
    x = np.sin(ph) * env(len(t), 0.002, 0.35) + 0.4 * hp(rng.standard_normal(len(t)), 3000) * env(len(t), 0.0005, 0.02); save(f'pop_{v}', x)
for v in range(4):  # whoosh: noise through sweeping bandpass, swell then fade
    d = 0.7 + 0.15 * v; t = T(d); n = rng.standard_normal(len(t)); out = np.zeros_like(n); seg = 512
    for i in range(0, len(n), seg):
        c = 300 + 2600 * np.sin(np.pi * i / len(n)) ** 1.5; out[i:i + seg] = bp(n[max(0, i - 2048):i + seg], c * 0.6, min(c * 1.6, 18000))[-len(n[i:i + seg]):]
    e = np.sin(np.pi * np.linspace(0, 1, len(t))) ** (1.6 + 0.3 * v); save(f'whoosh_{v}', out * e, 0.6)
for v in range(3):  # whip: short fast whoosh
    t = T(0.32); n = hp(rng.standard_normal(len(t)), 800 + 300 * v); e = np.exp(-((np.linspace(0, 1, len(t)) - 0.3) ** 2) / 0.02); save(f'whip_{v}', n * e, 0.8)
for v in range(4):  # boom: sub sine drop + filtered noise body + long tail
    d = 2.6; t = T(d); sub = np.sin(2 * np.pi * np.cumsum(55 * np.exp(-t * 2) + 28) / SR) * env(len(t), 0.004, 0.5)
    body = lp(rng.standard_normal(len(t)), 900 - 150 * v) * env(len(t), 0.002, 0.25 + 0.05 * v, 5); crack = hp(rng.standard_normal(len(t)), 2000) * env(len(t), 0.0005, 0.03)
    save(f'boom_{v}', 1.0 * sub + 1.3 * body + 0.4 * crack, 0.4)
for v in range(3):  # artillery: sharp crack + boom tail
    d = 2.2; t = T(d); crack = bp(rng.standard_normal(len(t)), 600, 6000) * env(len(t), 0.0003, 0.05, 6); tail = lp(rng.standard_normal(len(t)), 400) * env(len(t), 0.01, 0.6, 4)
    sub = np.sin(2 * np.pi * 45 * t) * env(len(t), 0.002, 0.3); save(f'artillery_{v}', 1.4 * crack + tail + 0.8 * sub, 0.3)
for v in range(6):  # type: tiny key click
    t = T(0.05); x = bp(rng.standard_normal(len(t)), 1500 + 300 * v, 7000) * env(len(t), 0.0003, 0.08, 8) + 0.3 * np.sin(2 * np.pi * (180 + 20 * v) * t) * env(len(t), 0.001, 0.12); save(f'type_{v}', x)
for v in range(3):  # ding: bell partials
    t = T(1.6); f = 1320 * (1 + 0.12 * v); x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * (2 + 1.5 * m)) for a, m in [(1, 1), (0.5, 2.0), (0.3, 2.76), (0.2, 5.4)]); save(f'ding_{v}', x)
for v in range(3):  # impact: low thud
    t = T(0.6); x = np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t * 12) + 45) / SR) * env(len(t), 0.001, 0.25) + 0.5 * lp(rng.standard_normal(len(t)), 600) * env(len(t), 0.001, 0.1); save(f'impact_{v}', x)
for v in range(2):  # riser: noise + pitched sweep up
    d = 2.0; t = T(d); r = np.linspace(0, 1, len(t)); tone = np.sin(2 * np.pi * np.cumsum(200 + 1600 * r ** 2) / SR); nz = hp(rng.standard_normal(len(t)), 1200)
    save(f'riser_{v}', (0.5 * tone + 0.6 * nz) * r ** 2.5 * (1 - np.exp(-(1 - r) * 60)), 0.5)
for v in range(3):  # paper: crinkle bursts
    t = T(0.7); x = np.zeros(len(t))
    for k in range(40): p = rng.integers(0, len(t) - 2000); L = rng.integers(200, 1500); x[p:p + L] += bp(rng.standard_normal(L), 1500, 9000) * np.hanning(L) * rng.uniform(0.2, 1)
    save(f'paper_{v}', x * np.sin(np.pi * np.linspace(0, 1, len(t))) ** 0.5, 0.5)
for v in range(2):  # stamp: thump + slap
    t = T(0.45); x = np.sin(2 * np.pi * np.cumsum(110 * np.exp(-t * 20) + 60) / SR) * env(len(t), 0.001, 0.2) + 0.9 * bp(rng.standard_normal(len(t)), 800, 5000) * env(len(t), 0.0003, 0.04, 6); save(f'stamp_{v}', x)
for v in range(4):  # rifle: crack + short room tail
    t = T(0.9); x = bp(rng.standard_normal(len(t)), 900, 9000) * env(len(t), 0.0002, 0.03, 8) + 0.5 * lp(rng.standard_normal(len(t)), 1500 - 200 * v) * env(len(t), 0.002, 0.3, 5); save(f'rifle_{v}', x, 0.3)
for v in range(3):  # shimmer: random high partials
    t = T(1.2); x = sum(np.sin(2 * np.pi * rng.uniform(2500, 7000) * t + rng.uniform(0, 6)) * np.exp(-((t - rng.uniform(0.05, 0.7)) ** 2) / 0.01) for _ in range(30)); save(f'shimmer_{v}', x, 0.7)
for v in range(2):  # plane: prop engine buzz with doppler
    d = 3.5; t = T(d); r = np.linspace(-1, 1, len(t)); f = 95 * (1 - 0.18 * np.tanh(r * 3)); saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    x = lp(saw + 0.3 * rng.standard_normal(len(t)), 1800) * np.exp(-r ** 2 * 3); save(f'plane_{v}', x, 0.9)
for v in range(2):  # fire crackle loop
    t = T(4.0); x = lp(rng.standard_normal(len(t)), 500) * 0.3
    for k in range(260): p = rng.integers(0, len(t) - 400); x[p:p + 300] += hp(rng.standard_normal(300), 2500) * np.hanning(300) * rng.uniform(0.3, 1.5)
    save(f'fire_{v}', x, 0.5)
print(len(os.listdir(OUT)), 'synth sfx')
