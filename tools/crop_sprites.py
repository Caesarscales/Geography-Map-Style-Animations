"""Trim transparent margins from sprite PNGs so sizes in beats.json mean the character's real height."""
import sys, glob
from PIL import Image
for d in sys.argv[1:]:
    for f in glob.glob(d + '/*.png'):
        im = Image.open(f).convert('RGBA'); bb = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        if bb and (bb[2] - bb[0] < im.width - 4 or bb[3] - bb[1] < im.height - 4): im.crop((max(0, bb[0] - 4), max(0, bb[1] - 4), min(im.width, bb[2] + 4), min(im.height, bb[3] + 4))).save(f)
