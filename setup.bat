@echo off
REM One-time setup (Windows). Needs Python 3.10+, Node 18+ and ffmpeg (winget install ffmpeg).
cd /d "%~dp0"
python -m pip install -r requirements.txt
call npm install --prefix engine
call npm install --prefix chibi
cd engine && call npx playwright install chromium && cd ..
python tools\setup_data.py
echo Setup done. Optional (real SFX + CC music from Openverse): python tools\collect_audio.py
pause
