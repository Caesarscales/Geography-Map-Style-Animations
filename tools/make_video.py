"""One command for the whole pipeline.
  python3 tools/make_video.py new <name>                 create projects/<name>/ (script.txt, beats.json, cast.json templates)
  python3 tools/make_video.py voice <name> --key K --voice V   ElevenLabs narration (ONE take) + word timings   (or: --file my.mp3)
  python3 tools/make_video.py build <name>               captions + missing map regions + chibi cast sprites
  python3 tools/make_video.py render <name> [--scale .5] render video (headless Chromium)
  python3 tools/make_video.py mix <name>                 voice + SFX + new music bed, mastered -> out/final.mp4
  python3 tools/make_video.py qa <name>                  style & camera check vs the reference library
  python3 tools/make_video.py all <name>                 build -> render -> mix -> qa
"""
import sys, os, json, subprocess, shutil
KIT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); PY = sys.executable
def run(*c): print('$', ' '.join(c)); subprocess.run(c, check=True, cwd=KIT)
cmd, name = sys.argv[1], sys.argv[2]; rest = sys.argv[3:]; P = os.path.join(KIT, 'projects', name)
if cmd == 'new':
    os.makedirs(P + '/sprites', exist_ok=True); os.makedirs(P + '/images', exist_ok=True)
    open(P + '/script.txt', 'w').write('Write the approved narration here, exactly as it should be spoken.\n')
    json.dump({'meta': {'title': name, 'words': 'words.json', 'watermark': '', 'regions': [], 'region_defs': {}}, 'camera': [], 'beats': []}, open(P + '/beats.json', 'w'), indent=1)
    json.dump({}, open(P + '/cast.json', 'w')); print('created', P)
elif cmd == 'voice': run(PY, 'tools/voice.py', P, *rest)
elif cmd in ('build', 'all'):
    run(PY, 'tools/make_captions.py', P)
    spec = json.load(open(P + '/beats.json')); meta = spec['meta']; idx = json.load(open(KIT + '/engine/data/skins/index.json'))
    defs = dict(meta.get('region_defs') or {})
    # auto: every camera key zoomed in past 30 px/deg gets a high-detail map patch
    sys.path.insert(0, KIT + '/tools'); from geo_lookup import lookup
    for k in spec.get('camera', []):
        if 'at' not in k: continue
        lon, lat, bb = lookup(k['at']); lon += k.get('dlon', 0); lat += k.get('dlat', 0); z = k.get('zoom')
        if not z and bb: z = min(1080 * 0.78 / max(bb[2] - bb[0], 0.3), 300)
        if not z or z < 30: continue
        ppd = int(min(max(z * 0.9, 45), 160)); span = min(max(1.8 * 1080 / z, 8), 30)
        if z < 45: continue
        key = f'auto_{round(lon)}_{round(lat)}_{ppd // 40}'.replace('-', 'm')
        if any(r in idx or r in defs for r in [key]): continue
        if any(abs(((lon - (d[0] + d[1]) / 2) + 180) % 360 - 180) < span * 0.3 and abs(lat - (d[2] + d[3]) / 2) < span * 0.3 and (len(d) < 5 or d[4] >= ppd * 0.8) for d in list(defs.values()) + [[v['lon0'], v['lon1'], v['lat0'], v['lat1'], v['ppd']] for v in idx.values() if 'lon0' in v and v.get('ppd', 0) > 30]): continue
        defs[key] = [round(lon - span / 2, 2), round(lon + span / 2, 2), round(max(lat - span * 0.6, -70), 2), round(min(lat + span * 0.6, 78), 2), ppd]
    for r, bb in defs.items():
        if r not in idx: run(PY, 'tools/prep_region.py', r, *map(str, bb))
    meta['regions'] = sorted(set(meta.get('regions') or []) | set(defs)); spec['meta'] = meta; json.dump(spec, open(P + '/beats.json', 'w'), indent=1)
    cast = json.load(open(P + '/cast.json')) if os.path.exists(P + '/cast.json') else {}
    if cast: run('node', 'chibi/shoot.js', P + '/cast.json', P + '/sprites')
    run(PY, 'tools/crop_sprites.py', P + '/sprites')
if cmd in ('render', 'all'): run('node', 'engine/render.js', name, *([a for a in rest if a] if cmd == 'render' else []))
if cmd in ('mix', 'all'): run(PY, 'tools/mix.py', P, *(rest if cmd == 'mix' else []))
if cmd in ('qa', 'all'): run(PY, 'tools/qa.py', P + '/out/final.mp4', P + '/out')
