import json, numpy as np, os, cv2
U='/mnt/user-data/uploads/'; A='/mnt/user-data/attachments/fd580107-7502-5eef-9418-8de3470dd53d/'
V={'colombia':'work/ref.mp4','oman':U+'Why_Is_Oman_Split_Into_Two____-_Geo_All_Day__1080p__h264__1.mp4',
'slavetrade':U+'How_the_Atlantic_Slave_Trade_Began_and_Ended___-_Geo_All_Day__1080p__h264__1.mp4',
'gambia':U+'Why_Is_The_Gambia_Shaped_Like_This____-_Geo_All_Day__1080p__h264__1.mp4',
'ww3':A+'d6379c3c-Top_Safest_Countries_for_World_War_3_-_Geo_All_Day_1080p_h264.mp4',
'planes':U+'Why_Planes_Follow_This_Invisible_Highway_______-_Geo_All_Day__1080p__h264_.mp4',
'uboats':U+'Why_German_U-Boats_Hunted_Ships_Near_America______-_Geo_All_Day__1080p__h264_.mp4',
'stan':U+'Why_Do_So_Many_Countries_End_in__-stan____-_Geo_All_Day__1080p__h264_.mp4',
'italy':U+'Why_Does_Italy_Have_This_Strange_Panhandle____-_Geo_All_Day__1080p__h264_.mp4'}
rows=[]
for k,v in V.items():
    P=json.load(open(f'studies/{k}/perframe.json')); m=json.load(open(f'studies/{k}/meta.json')) if os.path.exists(f'studies/{k}/meta.json') else {'dur':61.05,'fps':'30/1'}
    d=np.array([p['diff'] for p in P])
    # detect doubled frames -> true 30
    if eval(m['fps'])>40:
        z=d<0.05
        if z[0::2].mean()>0.5 or z[1::2].mean()>0.5: P=[max(P[i:i+2],key=lambda p:p['diff']) for i in range(0,len(P)-1,2)]; tf=30; real='60 (doubled, authored 30)'
        else:
            tf=60; real='60 native'
    else: tf=30; real='30'
    k30=tf/30
    d=np.array([p['diff'] for p in P])*k30
    s=np.array([p.get('scale') or 1 for p in P]); cam=np.hypot([p.get('tx') or 0 for p in P],[p.get('ty') or 0 for p in P])*k30; zoom=(s-1)*100*k30
    W=json.load(open(f'studies/{k}/words.json')); wps=len(W)/(W[-1][1]-W[0][0])
    lo=''
    if os.path.exists(f'studies/{k}/audio.txt'):
        for l in open(f'studies/{k}/audio.txt'):
            if 'I:' in l: lo=l.split()[1]; break
    else: lo='-17.2'
    rows.append(dict(v=k,dur=round(m['dur'],1),fps=real,words=len(W),wps=round(wps,2),lufs=lo,
        cam_moving=round(100*((cam>0.5)|(abs(zoom)>0.05)).mean(),1),still=round(100*(d<0.3).mean(),1),
        diff_med=round(float(np.median(d)),1),cam_med=round(float(np.median(cam)),1),cam_p95=round(float(np.percentile(cam,95)),1),
        zoom_p95=round(float(np.percentile(abs(zoom),95)),2),zin=round(100*(zoom>0.05).mean()),zout=round(100*(zoom<-0.05).mean()),
        hard=int(sum(1 for i in range(len(d)) if d[i]>45 and (i==0 or d[i-1]<=45)))))
json.dump(rows,open('studies/allstats.json','w'),indent=1)
for r in rows: print(r)
