#!/usr/bin/env bash
# One-time setup (macOS / Linux). Needs Python 3.10+, Node 18+, ffmpeg.
set -e; cd "$(dirname "$0")"
python3 -m pip install -r requirements.txt
npm install --prefix engine && npm install --prefix chibi && (cd engine && npx playwright install chromium)
python3 tools/setup_data.py
echo "Setup done. Optional (real SFX + CC music from Openverse): python3 tools/collect_audio.py"
