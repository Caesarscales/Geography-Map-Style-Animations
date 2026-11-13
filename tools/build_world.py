"""Build the engine's world data from Natural Earth (engine/data/ne/*.geojson) into compact Mercator files in engine/data/world/.
countries.json : {ISO3: {name, names[], rings:[[x,y]...]..., c:[lon,lat], bbox:[lon0,lat0,lon1,lat1], iso2}}
states.json    : {"ISO3:Name": {...same...}}
places.json    : [[name, lon, lat, pop, capital]]   seas.json: [[name, lon, lat, rings]]   rivers.json: [[name, [[x,y]...]]]   lakes.json: rings
"""
import json, math, os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'engine', 'data'); NE = R + '/ne'; OUT = R + '/world'; os.makedirs(OUT, exist_ok=True)
def my(lat): lat = max(min(lat, 85), -85); return (1 - math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) / math.pi) / 2
def q(v): return round(v, 5)
def ring(r, step=1): return [[q((x + 180) / 360), q(my(y))] for x, y in r[::step]] + [[q((r[-1][0] + 180) / 360), q(my(r[-1][1]))]]
def polys(g):
    if g is None: return []
    return g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
def area(r): return abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))) / 2
def feat(f, min_area=0.0):
    ps = [p[0] for p in polys(f['geometry']) if area(p[0]) >= min_area]
    if not ps: ps = [max((p[0] for p in polys(f['geometry'])), key=area)]
    big = max(ps, key=area); xs = [x for p in ps for x, _ in p]; ys = [y for p in ps for _, y in p]
    cx = sum(x for x, _ in big) / len(big); cy = sum(y for _, y in big) / len(big)
    return dict(rings=[ring(p, 1 if len(p) < 2000 else 2) for p in ps], c=[round(cx, 3), round(cy, 3)], bbox=[round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2)])
C = {}
for f in json.load(open(NE + '/ne_10m_admin_0_countries.geojson'))['features']:
    p = f['properties']; iso = p.get('ADM0_A3') or p.get('ISO_A3')
    d = feat(f, 0.0005); d.update(name=p.get('NAME'), iso2=(p.get('ISO_A2_EH') or p.get('ISO_A2') or '').lower(), names=sorted({n for n in [p.get('NAME'), p.get('NAME_LONG'), p.get('ADMIN'), p.get('FORMAL_EN'), p.get('NAME_SORT')] if n}))
    if p.get('LABEL_X') is not None: d['c'] = [round(p['LABEL_X'], 3), round(p['LABEL_Y'], 3)]
    C[iso] = d
json.dump(C, open(OUT + '/countries.json', 'w'), separators=(',', ':'))
S = {}
for f in json.load(open(NE + '/ne_50m_admin_1_states_provinces.geojson'))['features']:
    p = f['properties']; d = feat(f); d.update(name=p.get('name'), country=p.get('adm0_a3')); S[f"{p.get('adm0_a3')}:{p.get('name')}"] = d
json.dump(S, open(OUT + '/states.json', 'w'), separators=(',', ':'))
P = [[p['properties']['name'], round(p['geometry']['coordinates'][0], 3), round(p['geometry']['coordinates'][1], 3), p['properties'].get('pop_max') or 0, 1 if (p['properties'].get('adm0cap') or 0) else 0] for p in json.load(open(NE + '/ne_10m_populated_places_simple.geojson'))['features']]
json.dump(P, open(OUT + '/places.json', 'w'), separators=(',', ':'))
SE = []
for f in json.load(open(NE + '/ne_10m_geography_marine_polys.geojson'))['features']:
    p = f['properties']; d = feat(f); SE.append([p.get('name'), d['c'][0], d['c'][1], d['rings']])
json.dump(SE, open(OUT + '/seas.json', 'w'), separators=(',', ':'))
RV = []
for f in json.load(open(NE + '/ne_10m_rivers_lake_centerlines.geojson'))['features']:
    g = f['geometry']; lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    nm = f['properties'].get('name')
    if nm: RV.append([nm, [[[q((x + 180) / 360), q(my(y))] for x, y in l] for l in lines]])
json.dump(RV, open(OUT + '/rivers.json', 'w'), separators=(',', ':'))
LK = [r for f in json.load(open(NE + '/ne_50m_lakes.geojson'))['features'] for r in feat(f)['rings']]
json.dump(LK, open(OUT + '/lakes.json', 'w'), separators=(',', ':'))
for n in os.listdir(OUT): print(n, os.path.getsize(OUT + '/' + n) // 1024, 'KB')
print(len(C), 'countries', len(S), 'states', len(P), 'places', len(SE), 'seas', len(RV), 'rivers')
