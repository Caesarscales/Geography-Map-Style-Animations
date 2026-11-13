import sys, json, numpy as np
P=json.load(open(sys.argv[1])); fps=float(sys.argv[2]) if len(sys.argv)>2 else 30
k=fps/30  # normalise per-frame numbers to 30fps-equivalent
d=np.array([p['diff'] for p in P]); t=np.array([p['t'] for p in P])
s=np.array([p.get('scale') or 1 for p in P]); tx=np.array([p.get('tx') or 0 for p in P]); ty=np.array([p.get('ty') or 0 for p in P]); rot=np.array([p.get('rot') or 0 for p in P])
cam=np.hypot(tx,ty)*k; zoom=(s-1)*100*k; dd=d*k
print('frames',len(P),'fps',fps)
print('change/frame (30fps-eq): median %.1f p5 %.1f p95 %.1f'%(np.median(dd),np.percentile(dd,5),np.percentile(dd,95)))
still=dd<0.3; print('near-still frames: %d (%.2f%%)'%(still.sum(),100*still.mean()))
mv=(cam>0.5)|(abs(zoom)>0.05); print('camera moving: %.1f%% of frames'%(100*mv.mean()))
print('cam px/frame median %.1f p95 %.1f | zoom %%/frame median %.2f p95 %.2f'%(np.median(cam),np.percentile(cam,95),np.median(abs(zoom)),np.percentile(abs(zoom),95)))
print('rotation deg/frame p95 %.2f'%np.percentile(abs(rot*k),95))
hard=[round(t[i],2) for i in np.where(dd>45)[0]]
ev=[]
for x in hard:
    if not ev or x-ev[-1]>0.3: ev.append(x)
print('hard-change events (>45):',ev)
zin=(zoom>0.05).mean(); zout=(zoom<-0.05).mean(); print('zooming in %.0f%% / out %.0f%% of frames'%(100*zin,100*zout))
