"""Build captions.json (frame ranges) from words.json [[start,end,word],...]. 3-4 words per caption, breaks on punctuation/pauses,
switch exactly on word onsets (matches the reference: median lag 0.00 s, ~1.0-1.3 s on screen)."""
import json, sys, re
proj = sys.argv[1]; W = json.load(open(f'{proj}/words.json')); FPS = 30; caps = []; cur = []
def flush(next_start):
    if cur: caps.append([round(cur[0][0] * FPS), round(next_start * FPS), ' '.join(w[2] for w in cur).strip(' ,.;:!?"')])
for i, w in enumerate(W):
    cur.append(w); nxt = W[i + 1] if i + 1 < len(W) else None; text = ' '.join(x[2] for x in cur)
    brk = re.search(r'[.?!]$', w[2]) or (re.search(r'[,;:]$', w[2]) and len(cur) >= 2) or len(cur) >= 4 or (len(cur) >= 3 and len(text) > 16) or (nxt and nxt[0] - w[1] > 0.35) or not nxt
    if brk: flush(nxt[0] if nxt else w[1] + 0.3); cur = []
json.dump(caps, open(f'{proj}/captions.json', 'w')); print(len(caps), 'captions')
