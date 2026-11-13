"""Python mirror of the engine's place lookup (used to plan map regions)."""
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'engine', 'data', 'world')
C = json.load(open(D + '/countries.json')); S = json.load(open(D + '/states.json')); PL = json.load(open(D + '/places.json')); SE = json.load(open(D + '/seas.json'))
ALIAS = {'korea': 'PRK+KOR', 'korean peninsula': 'PRK+KOR', 'latin america': 'MEX+BRA+ARG+CHL+COL', 'europe': 'PRT+FIN+GRC+GBR', 'middle east': 'TUR+EGY+IRN+SAU+YEM', 'usa': 'USA', 'us': 'USA', 'uk': 'GBR', 'britain': 'GBR', 'united states': 'USA', 'soviet union': 'RUS', 'ussr': 'RUS'}
def lookup(name):
    if isinstance(name, list): return name[0], name[1], None
    if isinstance(name, dict): name = name.get('place') or name.get('screen') and [0, 0]
    if name in C: return C[name]['c'][0], C[name]['c'][1], C[name]['bbox']
    if name in S: return S[name]['c'][0], S[name]['c'][1], S[name]['bbox']
    n = name.lower()
    if n in ALIAS: return lookup(ALIAS[n])
    if '+' in name:
        ps = [lookup(x.strip()) for x in name.split('+')]; bb = [min(p[2][0] for p in ps), min(p[2][1] for p in ps), max(p[2][2] for p in ps), max(p[2][3] for p in ps)]
        return (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, bb
    for d in C.values():
        if any(x.lower() == n for x in d['names']): return d['c'][0], d['c'][1], d['bbox']
    pl = sorted([p for p in PL if p[0].lower() == n], key=lambda p: -p[3])
    if pl: return pl[0][1], pl[0][2], None
    for s in SE:
        if (s[0] or '').lower() == n: return s[1], s[2], None
    return 0, 0, None
