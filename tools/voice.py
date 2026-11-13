"""Generate the narration with ElevenLabs (ONE take) and word timings.
usage: python3 tools/voice.py <project_dir> --key <ELEVENLABS_API_KEY> --voice <VOICE_ID> [--model eleven_multilingual_v2]
Reads <project>/script.txt, writes voice.mp3 and words.json ([[start, end, word], ...]).
If you already have a voiceover file instead: python3 tools/voice.py <project_dir> --file my_voice.mp3   (words come from transcription)
Never run this without the person's go-ahead: it spends their ElevenLabs credits."""
import sys, os, json, base64, argparse, urllib.request, subprocess
ap = argparse.ArgumentParser(); ap.add_argument('proj'); ap.add_argument('--key'); ap.add_argument('--voice'); ap.add_argument('--model', default='eleven_multilingual_v2'); ap.add_argument('--file')
ap.add_argument('--stability', type=float, default=0.45); ap.add_argument('--similarity', type=float, default=0.8); ap.add_argument('--style', type=float, default=0.15)
a = ap.parse_args(); P = a.proj
def words_from_chars(al):
    ws, cur, st = [], '', None
    for ch, s, e in zip(al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']):
        if ch.isspace():
            if cur: ws.append([round(st, 3), round(prev_e, 3), cur]); cur = ''
            continue
        if not cur: st = s
        cur += ch; prev_e = e
    if cur: ws.append([round(st, 3), round(prev_e, 3), cur])
    return ws
if a.file:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.file, '-ar', '44100', '-b:a', '192k', f'{P}/voice.mp3'], check=True)
    from faster_whisper import WhisperModel; import numpy as np
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{P}/voice.mp3', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout
    seg, _ = WhisperModel('small.en', compute_type='int8').transcribe(np.frombuffer(raw, np.float32), word_timestamps=True)
    W = [[round(w.start, 3), round(w.end, 3), w.word.strip()] for s in seg for w in s.words]
else:
    if not (a.key and a.voice): sys.exit('need --key and --voice (or --file)')
    text = open(f'{P}/script.txt').read().strip()
    body = json.dumps({'text': text, 'model_id': a.model, 'voice_settings': {'stability': a.stability, 'similarity_boost': a.similarity, 'style': a.style, 'use_speaker_boost': True}}).encode()
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{a.voice}/with-timestamps?output_format=mp3_44100_128', data=body, headers={'xi-api-key': a.key, 'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req, timeout=300))
    open(f'{P}/voice.mp3', 'wb').write(base64.b64decode(r['audio_base64'])); W = words_from_chars(r['alignment'])
json.dump(W, open(f'{P}/words.json', 'w')); print(len(W), 'words,', W[-1][1] if W else 0, 's')
