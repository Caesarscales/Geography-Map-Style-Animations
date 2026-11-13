"""Final audio: voice + auto-placed SFX + a NEW music bed (never reused), ducked under the voice, mastered to -16 LUFS; muxed onto the video.
usage: python3 tools/mix.py <project_dir> [--music path.mp3] [--no-music] [--lufs -16]
Needs <project>/voice.mp3, <project>/out/video_noaudio.mp4, <project>/out/sfx_events.json (written by the renderer)."""
import sys, os, json, glob, random, argparse, subprocess, numpy as np
ap = argparse.ArgumentParser(); ap.add_argument('proj'); ap.add_argument('--music'); ap.add_argument('--no-music', action='store_true'); ap.add_argument('--lufs', type=float, default=-16)
ap.add_argument('--allow-synth', action='store_true', help='test renders only'); ap.add_argument('--sfx-gain', type=float, default=0.0); ap.add_argument('--music-gain', type=float, default=-19.0, help='music level in dB relative to the voice (in gaps; it drops ~8 dB more under speech)')
a = ap.parse_args(); P = a.proj.rstrip('/'); KIT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); LIB = KIT + '/audio_lib'; SR = 44100
def load(p): raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout; return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
voice = load(f'{P}/voice.mp3'); vid = f'{P}/out/video_noaudio.mp4'
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', vid], capture_output=True, text=True).stdout or len(voice) / SR)
N = int(dur * SR); bus = np.zeros((N, 2), np.float32); v = np.zeros((N, 2), np.float32); v[:min(N, len(voice))] = voice[:N]
# --- SFX: prefer real files (audio_lib/sfx/<cat>_*), fall back to synthesized (audio_lib/synth/<cat>_*) ---
cache, rot, last = {}, {}, {}
def pick(cat):
    files = sorted(glob.glob(f'{LIB}/sfx/{cat}_*')) or (sorted(glob.glob(f'{LIB}/synth/{cat}_*')) if a.allow_synth else [])
    if not files: return None
    i = rot.get(cat, random.randrange(len(files))); rot[cat] = (i + 1) % len(files); f = files[i]
    if f not in cache: cache[f] = load(f)
    return cache[f]
ev = json.load(open(f'{P}/out/sfx_events.json')); used = 0
for e in ev:
    t = e['f'] / 30; cat = e['cat']
    if t - last.get(cat, -9) < (0.05 if cat == 'type' else 0.12): continue
    s = pick(cat); 
    if s is None: continue
    i0 = int(t * SR); n = min(len(s), N - i0)
    if n <= 0: continue
    bus[i0:i0 + n] += s[:n] * (10 ** ((e['gain'] + a.sfx_gain) / 20)); last[cat] = t; used += 1
# keep SFX under the voice: duck the bus where the voice is loud
env = np.convolve(np.abs(v).mean(1), np.ones(2205) / 2205, 'same'); duck = 1 - 0.45 * np.clip(env / (env.max() + 1e-9) * 3, 0, 1); bus *= duck[:, None]
# --- music: an unused bed, looped/trimmed, ducked harder under the voice ---
mus = np.zeros((N, 2), np.float32); track = None
if not a.no_music:
    cred = json.load(open(f'{LIB}/CREDITS.json')) if os.path.exists(f'{LIB}/CREDITS.json') else {}
    track = a.music or next((f'{LIB}/music/{k}' for k, c in cred.items() if c.get('category') == 'music' and not c.get('used_in') and c.get('creator') != 'geo-kit synth' and os.path.exists(f'{LIB}/music/{k}')), None)
    if not track and not a.allow_synth: sys.exit('STOP: no real unused music track. Ask the person for music (or run tools/collect_audio.py on their PC). Never use generated music in a real video.')
    if track:
        m = load(track); reps = int(np.ceil(N / len(m))); m = np.tile(m, (reps, 1))[:N]; fade = int(2 * SR); m[-fade:] *= np.linspace(1, 0, fade)[:, None]
        # level the music against the voice, so a loud master track can't drown the narration
        sp = env > 0.25 * env.max(); vr = np.sqrt((v[sp] ** 2).mean() + 1e-12); mr = np.sqrt((m ** 2).mean() + 1e-12)
        mus = m * (vr / mr) * (10 ** (a.music_gain / 20)) * (1 - 0.6 * np.clip(env / (env.max() + 1e-9) * 3, 0, 1))[:, None]
        k = os.path.basename(track)
        if k in cred: cred[k]['used_in'] = os.path.basename(P); json.dump(cred, open(f'{LIB}/CREDITS.json', 'w'), indent=1)
    else: print('WARNING: no unused music in audio_lib/music — run tools/collect_audio.py on your PC, or pass --music. Rendering without music.')
mixd = v + bus + mus; mixd /= max(1.0, np.abs(mixd).max() / 0.98)
tmp = f'{P}/out/mix.wav'; subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', tmp], input=mixd.astype(np.float32).tobytes(), check=True)
out = f'{P}/out/final.mp4'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', vid, '-i', tmp, '-filter_complex', f'[1:a]loudnorm=I={a.lufs}:TP=-1.5:LRA=11[a]', '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out], check=True)
print(f'{used} sfx placed; music: {os.path.basename(track) if track else "none"}; ->', out)
