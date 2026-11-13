"""Detect caption change frames (caption band ~74-82% height) and compare to word onsets."""
import sys, json, cv2, numpy as np
src, words = sys.argv[1], json.load(open(sys.argv[2]))
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS); H = int(cap.get(4)); W = int(cap.get(3))
y0, y1 = int(H*0.75), int(H*0.81); prev=None; ev=[]; i=0
while True:
    ok,f=cap.read()
    if not ok: break
    band=f[y0:y1, int(W*0.15):int(W*0.85)]
    m=((band.min(axis=2)>235)).astype(np.uint8)  # near-white caption pixels
    if prev is not None:
        d=np.logical_xor(m,prev).sum()/max(1,m.sum()+prev.sum())
        if d>0.6 and m.sum()>150: ev.append(round(i/fps,3))
    prev=m; i+=1
# collapse events within 0.15 s
ce=[]
for t in ev:
    if not ce or t-ce[-1]>0.15: ce.append(t)
starts=[w[0] for w in words]
lags=[]
for t in ce:
    j=int(np.argmin([abs(s-t) for s in starts])); lags.append(round(t-starts[j],2))
print('caption changes:',len(ce),'words:',len(words),'avg words/caption: %.2f'%(len(words)/max(1,len(ce))))
print('lag vs nearest word onset (s): median %.2f  p10 %.2f p90 %.2f'%(np.median(lags),np.percentile(lags,10),np.percentile(lags,90)))
dur=np.diff(ce); print('caption on-screen duration: median %.2f s min %.2f max %.2f'%(np.median(dur),dur.min(),dur.max()))
