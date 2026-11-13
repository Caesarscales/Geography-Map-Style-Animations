# Geo Kit — map-explainer Shorts, made by Claude

> **Creator & MVP: Caesar ([@caesarscales](https://x.com/caesarscales)).** Locked credit — see `CREDITS.md` and `LICENSE`.

Recreates the Geo All Day style (chibi characters on an animated map, one never-stopping camera, word-synced captions) as a pipeline: **topic → script → ElevenLabs voice → beat list → video with sound → QA against the reference**.

## Setup (once)
- Windows: install Python 3.10+, Node 18+, ffmpeg (`winget install ffmpeg`), then double-click `setup.bat`.
- macOS/Linux: `./setup.sh`
- Optional, recommended: `python tools/collect_audio.py` pulls real sound effects and Creative Commons music from Openverse (credits logged in `audio_lib/CREDITS.json`). Real sound effects and music are required for finished videos: run it, or drop your own files into `audio_lib/sfx/` and `audio_lib/music/` (the synthesized kit is for silent test renders only).

Setup downloads NASA Blue Marble + Natural Earth (about 400 MB) and builds the world map.

## Make a video (with Claude)
Open this folder in Claude and say "make a video about <topic>". Claude follows `CLAUDE.md`: idea → script for your OK → asks for your ElevenLabs key/voice (or your recording) → writes the beat list → renders, mixes, checks.

By hand:
```
python tools/make_video.py new myvideo
# put the approved script in projects/myvideo/script.txt
python tools/make_video.py voice myvideo --key YOUR_KEY --voice VOICE_ID
# write projects/myvideo/beats.json (docs/BEATS.md)
python tools/make_video.py all myvideo        # -> projects/myvideo/out/final.mp4
```

## What's inside
- `engine/` map engine + beat interpreter + every effect (docs/BEATS.md)
- `chibi/` the chibi character/prop renderer (approved style) and a library of ready characters
- `audio_lib/` sound effects (synthesized + Openverse) and music beds
- `tools/` voice, captions, regions, mixing, QA, study tools
- `reference/`, `studies/` frame-by-frame study of 9 reference videos + camera/colour numbers every render is checked against
- `STUDY.md`, `RULEBOOK.md`, `CLAUDE.md` the style bible, rules and workflow
- `projects/test_colombia/` a worked example (first 25 s of the Colombia video as a beat list; supply your own voice file)
- `examples/colombia_recreation/` the full hand-built frame-by-frame recreation

## Licence
MIT. Created by Caesar ([@caesarscales](https://x.com/caesarscales)) — keep `CREDITS.md` and `LICENSE` in every copy.
