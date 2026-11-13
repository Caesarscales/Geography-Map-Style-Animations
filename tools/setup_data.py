"""Download the big source data once and build the world map skins. Run by setup.sh / setup.bat."""
import os, urllib.request, zipfile, subprocess, sys
KIT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); SRC = KIT + '/engine/data/src'; NE = KIT + '/engine/data/ne'; os.makedirs(SRC, exist_ok=True); os.makedirs(NE, exist_ok=True)
UA = {'User-Agent': 'geo-kit-setup/1.0'}
def get(url, out):
    if os.path.exists(out) and os.path.getsize(out) > 1000: print('have', os.path.basename(out)); return
    print('downloading', url); req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=600) as r, open(out + '.part', 'wb') as f:
        while True:
            b = r.read(1 << 20)
            if not b: break
            f.write(b)
    os.replace(out + '.part', out)
get('https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/march/world.topo.bathy.200403.3x21600x10800.jpg', SRC + '/bluemarble.jpg')
if not os.path.exists(SRC + '/SR_HR.tif'):
    get('https://naciscdn.org/naturalearth/10m/raster/SR_HR.zip', SRC + '/SR_HR.zip'); zipfile.ZipFile(SRC + '/SR_HR.zip').extract('SR_HR.tif', SRC); os.remove(SRC + '/SR_HR.zip')
B = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
for f in ['ne_10m_admin_0_countries', 'ne_50m_admin_1_states_provinces', 'ne_10m_populated_places_simple', 'ne_10m_rivers_lake_centerlines', 'ne_10m_geography_marine_polys', 'ne_50m_lakes']: get(B + f + '.geojson', f'{NE}/{f}.geojson')
subprocess.run([sys.executable, KIT + '/tools/build_world.py'], check=True)
if not os.path.exists(KIT + '/engine/data/skins/atlas_world.jpg'): subprocess.run([sys.executable, KIT + '/tools/prep_region.py', 'world'], check=True)
if not os.listdir(KIT + '/audio_lib/synth') if os.path.isdir(KIT + '/audio_lib/synth') else True: subprocess.run([sys.executable, KIT + '/tools/synth_sfx.py'], check=True)
print('data ready')
