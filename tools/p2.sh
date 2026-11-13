#!/bin/bash
# usage: p2.sh video outdir fps start:name ...   (0.5 s windows at full frame rate for 60fps, 1 s for 30fps)
V=$1; O=$2; FPS=$3; shift 3; mkdir -p $O
F=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf
if [ "$FPS" = 60 ]; then D=0.5; else D=1.0; fi
for w in "$@"; do s=${w%%:*}; n=${w##*:}
ffmpeg -v error -y -ss $s -i "$V" -t $D -vf "scale=216:-1,drawtext=fontfile=$F:text='%{eif\:(t+$s)*$FPS\:d}':x=3:y=3:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.7,tile=10x3" -frames:v 1 $O/$n.jpg; done
