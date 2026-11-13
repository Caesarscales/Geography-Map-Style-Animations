#!/bin/bash
# compact pass-1 sheet: 2.5 fps, 8x4 tiles (12.8 s per sheet)
V=$1; O=$2; mkdir -p $O; F=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf
ffmpeg -v error -y -i "$V" -vf "fps=2.5,scale=180:-1,drawtext=fontfile=$F:text='%{pts\:hms}':x=2:y=2:fontsize=13:fontcolor=yellow:box=1:boxcolor=black@0.7,tile=8x4" $O/c%02d.jpg
