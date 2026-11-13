"""Build map skins for a region (or the whole world) into <data>/skins/.
usage:
  python3 tools/prep_region.py world                         -> world-wide base skins (8192 px wide)
  python3 tools/prep_region.py <name> lon0 lon1 lat0 lat1 [ppd]  -> high-detail patch (default 60 px per degree)
Outputs per region: sat_<n>.jpg (graded satellite), atlas_<n>.jpg (their light map), relief_<n>.jpg (grey hillshade+bathymetry),
mask_<n>.png (land mask). The engine builds every other skin (old atlas, blueprint, teal, war, grey, minimal) from relief+mask at runtime.
Inputs (downloaded by setup): data/src/bluemarble.jpg (NASA BMNG topo-bathy 21600x10800), data/src/SR_HR.tif (Natural Earth shaded relief).
"""
import sys, os, json, math, numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
Image.MAX_IMAGE_PIXELS = None
ENG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'engine'); D = ENG + '/data'; SK = D + '/skins'; os.makedirs(SK, exist_ok=True)
def my(lat): lat = max(min(lat, 85), -85); return (1 - math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) / math.pi) / 2

args = sys.argv[1:]
if args[0] == 'world': name, lon0, lon1, lat0, lat1, ppd = 'world', -180, 180, -70, 85, 8192 / 360
else: name = args[0]; lon0, lon1, lat0, lat1 = map(float, args[1:5]); ppd = float(args[5]) if len(args) > 5 else 60
W = int((lon1 - lon0) * ppd); y0, y1 = my(lat1), my(lat0); H = int((y1 - y0) * 360 * ppd)
xs = np.linspace(lon0, lon1, W, endpoint=False); ys = np.linspace(y0, y1, H, endpoint=False)
lats = np.degrees(2 * np.arctan(np.exp((1 - 2 * ys) * math.pi)) - math.pi / 2)

def sample(img):
    SW, SH = img.size; sx = ((xs + 180) / 360 * SW).astype(int) % SW; sy = np.clip(((90 - lats) / 180 * SH).astype(int), 0, SH - 1)
    x0, x1 = sx.min(), sx.max() + 1; yy0, yy1 = sy.min(), sy.max() + 1
    a = np.asarray(img.crop((x0, yy0, x1, yy1))); return a[(sy - yy0)[:, None], (sx - x0)[None, :]]

# --- satellite (graded like the reference: brighter, cyan-shifted water) ---
bm = Image.open(D + '/src/bluemarble.jpg').convert('RGB')
if ppd < 40: bm = bm.resize((10800, 5400), Image.LANCZOS)
sat = Image.fromarray(sample(bm)); del bm
sat = ImageEnhance.Contrast(ImageEnhance.Color(ImageEnhance.Brightness(sat).enhance(1.32)).enhance(1.15)).enhance(0.95)
A = np.asarray(sat); OUTS = np.empty_like(A)
for i in range(0, H, 512):
    a = A[i:i + 512].astype(np.float32); r, g, b = a[..., 0], a[..., 1], a[..., 2]; w = np.clip((b - r) / 80, 0, 1)
    OUTS[i:i + 512] = np.clip(np.stack([r * (1 - 0.1 * w), g * (1 - 0.35 * w) + b * 0.42 * w, b * (1 - 0.12 * w)], -1) * np.where(w[..., None] > 0, 1.08, 1), 0, 255).astype(np.uint8)
del A, sat; satimg = Image.fromarray(OUTS); satimg.save(f'{SK}/sat_{name}.jpg', quality=92)
satl = np.asarray(satimg.convert('L')).astype(np.float32) / 255

# --- land mask from Natural Earth countries ---
C = json.load(open(D + '/world/countries.json'))
mask = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(mask); x0u = (lon0 + 180) / 360
for d in C.values():
    for ring in d['rings']:
        pts = [((x - x0u) * 360 * ppd, (y - y0) * 360 * ppd) for x, y in ring]
        if len(pts) > 2: dr.polygon(pts, fill=255)
mask.save(f'{SK}/mask_{name}.png'); mk = np.asarray(mask.filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255

# --- relief (Natural Earth shaded relief on land, satellite-derived bathymetry at sea) ---
SR = Image.open(D + '/src/SR_HR.tif').convert('L')
sr = np.asarray(Image.fromarray(sample(SR)).filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255; del SR
flat = np.median(sr[mk > 0.5]) if (mk > 0.5).any() else 0.7
relief = np.clip((sr - flat) * 1.25, -0.45, 0.2)
lum = Image.fromarray((satl * 255).astype(np.uint8)); fine = np.asarray(lum.filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255; broad = np.asarray(lum.filter(ImageFilter.GaussianBlur(8))).astype(np.float32) / 255
bathy = np.clip((fine - broad) * 1.6, -0.15, 0.15)
rel = np.where(mk > 0.5, relief, bathy * 0.8)
Image.fromarray(np.clip(128 + rel * 255, 0, 255).astype(np.uint8)).save(f'{SK}/relief_{name}.jpg', quality=90)

# --- atlas skin (the reference's main light map), in strips to save memory ---
gimg = Image.fromarray(np.clip((OUTS[..., 1].astype(np.int16) - OUTS[..., 0].astype(np.int16)) * 6 + 77, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)); GR = np.asarray(gimg)
EDGE = np.asarray(mask.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(0.7)))
land = np.array([222, 233, 206], np.float32) / 255; low = np.array([192, 222, 170], np.float32) / 255
sea = np.array([118, 196, 236], np.float32) / 255; seaD = np.array([92, 176, 226], np.float32) / 255
ATL = np.empty((H, W, 3), np.uint8)
for i in range(0, H, 512):
    sl = slice(i, i + 512); green = GR[sl].astype(np.float32)[..., None] / 255; m = mk[sl][..., None]
    L = (land * (1 - green * 0.8) + low * green * 0.8) * (1 + relief[sl][..., None])
    deep = np.clip(1 - satl[sl] * 3.2, 0, 1)[..., None]; S = sea * (1 - deep) + seaD * deep + bathy[sl][..., None] * 0.35
    img = L * m + S * (1 - m); e = EDGE[sl].astype(np.float32)[..., None] / 255; img = img * (1 - e * 0.45) + e * 0.45
    ATL[sl] = (np.clip(img, 0, 1) * 255).astype(np.uint8)
Image.fromarray(ATL).save(f'{SK}/atlas_{name}.jpg', quality=92)

idx = SK + '/index.json'; I = json.load(open(idx)) if os.path.exists(idx) else {}
I[name] = dict(lon0=lon0, lon1=lon1, lat0=lat0, lat1=lat1, w=W, h=H, ppd=round(ppd, 3)); json.dump(I, open(idx, 'w'), indent=1)
print('built', name, W, 'x', H)
