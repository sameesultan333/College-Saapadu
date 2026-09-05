"""
live_yolo.py — Smart Canteen AI Queue Intelligence Engine  v3.1
═══════════════════════════════════════════════════════════════
Fixes in v3.1:
  • "0 people ???" — advisory hidden when queue=0 and no tracks
  • "Join Now ~11s" when queue=0 fixed — shows "Clear, walk in" instead
  • Surge / overcrowd banners moved to BOTTOM — never cover HUD stats
  • All display values rounded — no floats like 53.2222
  • Confidence / LineInteg hidden from HUD when no tracks (avoids 0.000 spam)
  • FPS rounded to int
"""

import json, math, threading, time
from collections import deque
from dataclasses import dataclass, field
from typing import Dict

import cv2
import numpy as np
from deep_sort_realtime.deepsort_tracker import DeepSort
from shapely.geometry import Point, Polygon
from ultralytics import YOLO

# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

RTSP_URL            = "rtsp://172.20.10.4:5543/live/channel0"
FRAME_W, FRAME_H    = 854, 480
RTSP_RECONNECT_SEC  = 3.0

MODEL_PATH          = "yolov8m.pt"
CONFIDENCE          = 0.38
NMS_PERSON_IOU      = 0.38
IMG_SIZE            = 640

try:
    import torch
    if torch.cuda.is_available():            DEVICE = "cuda"
    elif torch.backends.mps.is_available():  DEVICE = "mps"
    else:                                    DEVICE = "cpu"
except ImportError:
    DEVICE = "cpu"

DETECT_EVERY_N       = 2
DS_MAX_AGE           = 40
DS_N_INIT            = 3
DS_MAX_IOU_DIST      = 0.65
DS_MAX_COSINE_DIST   = 0.25
DS_NN_BUDGET         = 120

QUEUE_POLY_PTS = [(80,140),(774,140),(820,460),(34,460)]

STAFF_EXCL_Y         = 120
QUEUE_VECTOR_DEG     = 270.0
QUEUE_ANGLE_TOL      = 30.0
DEPTH_SEGS           = 5
DEPTH_SEG_LABELS     = ["At Counter","Near Front","Middle","Near Back","Back of Queue"]

MIN_DWELL_SEC        = 2.0
MIN_CONF_QUEUE       = 0.50
FOOT_ANCHOR_RATIO    = 0.74
ASPECT_RATIO_MIN     = 0.20
ASPECT_RATIO_MAX     = 0.90
EDGE_MARGIN_PX       = 10
MAX_VELOCITY         = 20
VELOCITY_STILL       = 4.5
VELOCITY_WINS        = 8
REENTRY_COOLDOWN     = 10.0
DWELL_DECAY_SEC      = 8.0

TEMPORAL_NMS_THRESH  = 0.55
TEMPORAL_NMS_WINDOW  = 3
MIN_CONFIRMED_FRAMES = 4

KF_PROCESS_NOISE     = 8e-4
KF_MEASURE_NOISE     = 6e-2
SMOOTH_WINDOW        = 12
HEATMAP_DECAY        = 0.993
HEATMAP_THRESH       = 0.10

CROWD_THRESHOLD      = 6
CROWD_SECONDS        = 5.0
DENSITY_MED          = 3
DENSITY_HIGH         = 6
SERVICE_HISTORY      = 15
MIN_SERVICE_SEC      = 2.0
DEFAULT_SERVICE      = 22

THROUGHPUT_WINDOW    = 60
SURGE_DELTA          = 3
SURGE_CHECK_SEC      = 15.0
TREND_WINDOW         = 6
GO_NOW_THRESHOLD     = 2

CANTEEN_ID           = 1
BACKEND_URL          = "http://localhost:8000/internal/queue-update"
PUSH_INTERVAL        = 3.0

# Banner at very bottom — HUD always safe above it
BANNER_H             = 38

COL_GREEN  = ( 50,220, 50);  COL_YELLOW = ( 30,200,255)
COL_RED    = ( 40, 40,255);  COL_ORANGE = ( 20,130,255)
COL_CYAN   = (220,220, 50);  COL_WHITE  = (255,255,255)
COL_BLACK  = (  0,  0,  0);  COL_GREY   = (110,110,110)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — KALMAN SMOOTHER
# ══════════════════════════════════════════════════════════════════════════════

class KalmanSmoother:
    def __init__(self):
        self.x=0.0; self.p=1.0
        self.q=KF_PROCESS_NOISE; self.r=KF_MEASURE_NOISE; self._pz=0.0
    def update(self,z):
        q_a=self.q*(1.0+abs(z-self._pz)*0.4); self._pz=z
        self.p+=q_a; k=self.p/(self.p+self.r)
        self.x+=k*(z-self.x); self.p*=(1.0-k)
        return max(0.0,self.x)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — PERSON STATE
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class PersonState:
    positions    :deque = field(default_factory=lambda:deque(maxlen=VELOCITY_WINS))
    in_roi       :bool  = False
    roi_entry    :float = 0.0
    dwell        :float = 0.0
    counted      :bool  = False
    last_seen    :float = field(default_factory=time.time)
    depth_seg    :int   = DEPTH_SEGS-1
    det_conf     :float = 0.5
    heatmap_val  :float = 0.0
    last_exit_time:float= 0.0
    confirmed_frames:int= 0
    queue_position:int  = 0

    def _vsamps(self):
        if len(self.positions)<2: return [0.0]
        return [math.hypot(self.positions[i][0]-self.positions[i-1][0],
                           self.positions[i][1]-self.positions[i-1][1])
                for i in range(1,len(self.positions))]
    def velocity_smooth(self):
        s=sorted(self._vsamps()); mid=len(s)//2
        return s[mid] if len(s)%2 else (s[mid-1]+s[mid])/2.0
    def movement_angle_deg(self):
        if len(self.positions)<3: return QUEUE_VECTOR_DEG
        dx=self.positions[-1][0]-self.positions[-3][0]
        dy=self.positions[-1][1]-self.positions[-3][1]
        if abs(dx)<1 and abs(dy)<1: return QUEUE_VECTOR_DEG
        return math.degrees(math.atan2(-dy,dx))%360.0
    def is_standing(self):  return self.velocity_smooth()<=MAX_VELOCITY
    def is_truly_still(self): return self.velocity_smooth()<=VELOCITY_STILL
    def is_direction_ok(self):
        v=self.velocity_smooth()
        if v<3.5: return True
        diff=abs(self.movement_angle_deg()-QUEUE_VECTOR_DEG)%360.0
        if diff>180.0: diff=360.0-diff
        return diff<=QUEUE_ANGLE_TOL
    def confidence_score(self):
        dw=min(1.0,self.dwell/(MIN_DWELL_SEC*2.0))
        dr=1.0 if self.is_direction_ok() else 0.20
        ht=min(1.0,self.heatmap_val/HEATMAP_THRESH) if self.heatmap_val>0 else 0.30
        dt=min(1.0,self.det_conf*1.30)
        st=1.0 if self.is_truly_still() else (0.55 if self.is_standing() else 0.0)
        tr=min(1.0,self.confirmed_frames/10.0)
        return round(0.28*dw+0.20*dr+0.18*ht+0.16*dt+0.12*st+0.06*tr,3)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — TEMPORAL NMS
# ══════════════════════════════════════════════════════════════════════════════

def _iou(ax1,ay1,ax2,ay2,bx1,by1,bx2,by2):
    ix1,iy1=max(ax1,bx1),max(ay1,by1); ix2,iy2=min(ax2,bx2),min(ay2,by2)
    inter=max(0,ix2-ix1)*max(0,iy2-iy1)
    if inter==0: return 0.0
    return inter/max(1e-5,(ax2-ax1)*(ay2-ay1)+(bx2-bx1)*(by2-by1)-inter)

class TemporalNMS:
    def __init__(self): self._h=deque(maxlen=TEMPORAL_NMS_WINDOW)
    def filter(self,dets):
        if not self._h: self._h.append(dets); return dets
        kept=[]
        for d in dets:
            x1,y1,w,h=d[0]; x2,y2=x1+w,y1+h; sup=False
            for pf in self._h:
                for p in pf:
                    px1,py1,pw,ph=p[0]; px2,py2=px1+pw,py1+ph
                    if _iou(x1,y1,x2,y2,px1,py1,px2,py2)>TEMPORAL_NMS_THRESH and abs(d[1]-p[1])<0.15:
                        sup=True; break
                if sup: break
            if not sup: kept.append(d)
        self._h.append(dets)
        return kept if kept else dets


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — HEATMAP
# ══════════════════════════════════════════════════════════════════════════════

class RollingHeatmap:
    def __init__(self,w,h):
        self._m=np.zeros((h,w),dtype=np.float32); self.w=w; self.h=h
    def update(self,pts):
        self._m*=HEATMAP_DECAY
        for fx,fy in pts:
            cv2.circle(self._m,(int(np.clip(fx,0,self.w-1)),int(np.clip(fy,0,self.h-1))),26,0.40,-1)
        np.clip(self._m,0.0,1.0,out=self._m)
    def query(self,fx,fy):
        return float(self._m[int(np.clip(fy,0,self.h-1)),int(np.clip(fx,0,self.w-1))])
    def overlay_bgr(self):
        return cv2.applyColorMap((self._m*255).astype(np.uint8),cv2.COLORMAP_JET)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — PERSPECTIVE
# ══════════════════════════════════════════════════════════════════════════════

class PerspectiveCorrector:
    def __init__(self,quad):
        src=np.float32(quad[:4]); dst=np.float32([[0,0],[100,0],[100,100],[0,100]])
        self.H,_=cv2.findHomography(src,dst)
    def norm_uv(self,x,y):
        if self.H is None: return 50.0,50.0
        o=cv2.perspectiveTransform(np.float32([[[x,y]]]),self.H)
        return float(o[0][0][0]),float(o[0][0][1])
    def depth_segment(self,x,y):
        _,v=self.norm_uv(x,y)
        return int(np.clip(v/(100.0/DEPTH_SEGS),0,DEPTH_SEGS-1))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 7 — LINE INTEGRITY
# ══════════════════════════════════════════════════════════════════════════════

def line_integrity(states,active_ids):
    if len(active_ids)<2: return 1.0 if active_ids else 0.0
    pts=[states[t].positions[-1] for t in active_ids if t in states and states[t].positions]
    if len(pts)<2: return 0.5
    arr=np.float32(pts); cov=np.cov((arr-arr.mean(0)).T)
    if cov.ndim<2: return 1.0
    ev=np.sort(np.linalg.eigvalsh(cov))[::-1]; s=float(ev.sum())
    return round(float(ev[0])/s,3) if s>1e-6 else 1.0


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 8 — WAIT PREDICTOR
# ══════════════════════════════════════════════════════════════════════════════

class WaitPredictor:
    @staticmethod
    def predict_for_position(pos,avg_svc,slowdown=1.0):
        if pos<=0: return 0
        return max(0,int((pos-0.5)*max(avg_svc,avg_svc*slowdown)))
    @staticmethod
    def advisory_message(q,avg_svc,slowdown=1.0):
        if q==0: return "Queue clear — walk straight to the counter"
        if q<=GO_NOW_THRESHOLD:
            w=WaitPredictor.predict_for_position(q+1,avg_svc,slowdown)
            return f"Short queue — go now, about {_fmt(w)} wait"
        w=WaitPredictor.predict_for_position(q+1,avg_svc,slowdown)
        return f"Join queue now — about {_fmt(w)} estimated wait"


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 9 — RTSP STREAM
# ══════════════════════════════════════════════════════════════════════════════

class RTSPStream:
    def __init__(self,url):
        self.url=url; self._f=None; self._ok=False
        self._l=threading.Lock(); self._s=threading.Event()
        threading.Thread(target=self._reader,daemon=True).start()
    def _open(self):
        while not self._s.is_set():
            cap=cv2.VideoCapture(self.url,cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE,1)
            if cap.isOpened(): print("[STREAM] Connected"); return cap
            cap.release(); time.sleep(RTSP_RECONNECT_SEC)
        return cv2.VideoCapture()
    def _reader(self):
        cap=self._open()
        while not self._s.is_set():
            ret,frame=cap.read()
            if not ret: cap.release(); time.sleep(RTSP_RECONNECT_SEC); cap=self._open(); continue
            with self._l: self._f=frame; self._ok=True
        cap.release()
    def read(self):
        with self._l: return self._ok,(self._f.copy() if self._ok else None)
    def stop(self): self._s.set()


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 10 — DETECTION
# ══════════════════════════════════════════════════════════════════════════════

_tnms=None

def run_detection(frame):
    results=model(frame,conf=CONFIDENCE,iou=NMS_PERSON_IOU,
                  imgsz=IMG_SIZE,classes=[0],device=DEVICE,verbose=False)
    raw=[]
    for r in results:
        if r.boxes is None: continue
        for box in r.boxes:
            x1,y1,x2,y2=box.xyxy[0].tolist(); bw,bh=x2-x1,y2-y1
            if bh<1: continue
            ar=bw/bh
            if ar<ASPECT_RATIO_MIN or ar>ASPECT_RATIO_MAX: continue
            if x1<EDGE_MARGIN_PX or y1<EDGE_MARGIN_PX: continue
            if x2>FRAME_W-EDGE_MARGIN_PX or y2>FRAME_H-EDGE_MARGIN_PX: continue
            raw.append(([x1,y1,bw,bh],float(box.conf[0]),"person"))
    if _tnms: raw=_tnms.filter(raw)
    return raw

def in_roi(x1,y1,x2,y2):
    fy=y1+(y2-y1)*FOOT_ANCHOR_RATIO
    if fy<STAFF_EXCL_Y: return False
    return queue_polygon.contains(Point((x1+x2)/2.0,fy))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 11 — ANALYTICS ENGINE
# ══════════════════════════════════════════════════════════════════════════════

class QueueAnalytics:
    def __init__(self):
        self.states={}; self.service_times=deque(maxlen=SERVICE_HISTORY)
        self.count_buf=deque(maxlen=SMOOTH_WINDOW); self.kalman=KalmanSmoother()
        self.heatmap=RollingHeatmap(FRAME_W,FRAME_H)
        self.perspective=PerspectiveCorrector(QUEUE_POLY_PTS)
        self.overcrowd_start=None; self.overcrowded=False
        self._lock=threading.Lock(); self._snap=self._zero()
        self._exit_times=deque(); self._surge_buf=deque(maxlen=30)
        self._surge_alert=False; self._trend_buf=deque(maxlen=TREND_WINDOW)
        self._qorder={}

    def _record_exit(self,now): self._exit_times.append(now)
    def _throughput(self,now):
        cutoff=now-THROUGHPUT_WINDOW
        while self._exit_times and self._exit_times[0]<cutoff: self._exit_times.popleft()
        if not self._exit_times: return 0.0
        return round(len(self._exit_times)*(60.0/THROUGHPUT_WINDOW),1)
    def _check_surge(self,now,cnt):
        self._surge_buf.append((now,cnt))
        rc=[(t,c) for t,c in self._surge_buf if t>=now-SURGE_CHECK_SEC]
        return len(rc)>=2 and (cnt-rc[0][1])>=SURGE_DELTA
    def _compute_trend(self,cnt):
        self._trend_buf.append(cnt)
        if len(self._trend_buf)<3: return "stable"
        d=self._trend_buf[-1]-self._trend_buf[0]
        return "rising" if d>=2 else "falling" if d<=-2 else "stable"
    def _assign_positions(self,q_ids):
        if not q_ids: return {}
        items=[(t,self.states[t].depth_seg,self.states[t].positions[-1][1])
               for t in q_ids if t in self.states and self.states[t].positions]
        items.sort(key=lambda x:(x[1],x[2]))
        return {t:r+1 for r,(t,_,_) in enumerate(items)}

    def process(self,raw_tracks,now):
        seen,display,foot_pts=set(),[],[]
        for t in raw_tracks:
            if not t.is_confirmed(): continue
            tid=int(t.track_id); ltrb=t.to_ltrb()
            x1,y1,x2,y2=int(ltrb[0]),int(ltrb[1]),int(ltrb[2]),int(ltrb[3])
            cx,cy=(x1+x2)/2.0,(y1+y2)/2.0; fx,fy=int(cx),int(y2)
            seen.add(tid)
            if tid not in self.states: self.states[tid]=PersonState()
            s=self.states[tid]; s.last_seen=now; s.positions.append((cx,cy))
            s.confirmed_frames+=1
            s.depth_seg=self.perspective.depth_segment(cx,float(y2))
            s.heatmap_val=self.heatmap.query(fx,fy)
            inside=in_roi(x1,y1,x2,y2); standing=s.is_standing()
            dir_ok=s.is_direction_ok(); ghost=s.confirmed_frames<MIN_CONFIRMED_FRAMES
            if inside and standing and dir_ok and not ghost:
                if not s.in_roi:
                    if now-s.last_exit_time>=REENTRY_COOLDOWN:
                        s.in_roi=True; s.roi_entry=now; s.dwell=0.0; s.counted=False
                else:
                    s.dwell=now-s.roi_entry
                    if s.dwell>=MIN_DWELL_SEC and s.confidence_score()>=MIN_CONF_QUEUE:
                        s.counted=True
                foot_pts.append((fx,fy))
            elif inside and not(standing and dir_ok):
                s.in_roi=False; s.dwell=0.0; s.counted=False
            else:
                if s.in_roi and s.counted:
                    svc=now-s.roi_entry
                    if svc>=MIN_SERVICE_SEC: self.service_times.append(int(svc)); self._record_exit(now)
                if s.in_roi: s.last_exit_time=now
                s.in_roi=False; s.dwell=0.0; s.counted=False
            lbl="queuing" if s.counted else "entering" if s.in_roi else "outside"
            display.append((tid,x1,y1,x2,y2,lbl,s.dwell,s.confidence_score(),s.depth_seg,0))
        self.heatmap.update(foot_pts)
        for k in[k for k,v in self.states.items() if k not in seen and now-v.last_seen>DWELL_DECAY_SEC]:
            del self.states[k]
        q_ids=[d[0] for d in display if d[5]=="queuing"]
        self._qorder=self._assign_positions(q_ids)
        display=[(d[0],d[1],d[2],d[3],d[4],d[5],d[6],d[7],d[8],self._qorder.get(d[0],0)) for d in display]
        m=self._compute(now,display)
        with self._lock: self._snap=m
        return display,m

    def _compute(self,now,display):
        q_ids=[d[0] for d in display if d[5]=="queuing"]
        entering=[d[0] for d in display if d[5]=="entering"]
        self.count_buf.append(len(q_ids))
        smoothed=max(0,int(round(self.kalman.update(
            sum(self.count_buf)/len(self.count_buf) if self.count_buf else 0))))
        waits=[int(now-s.roi_entry) for t in q_ids if(s:=self.states.get(t)) and s.roi_entry]
        avg_wait=int(sum(waits)/len(waits)) if waits else 0
        avg_svc=(int(sum(self.service_times)/len(self.service_times))
                 if self.service_times else DEFAULT_SERVICE)
        thru=self._throughput(now)
        if thru>0: slowdown=max(1.0,(60.0/max(avg_svc,1))/thru)
        else: slowdown=1.5 if self.overcrowded else(1.2 if self._surge_alert else 1.0)
        eff_svc=max(avg_svc,int(avg_svc*slowdown))
        pw={pos:WaitPredictor.predict_for_position(pos,avg_svc,slowdown) for pos in range(1,smoothed+2)}
        advisory=WaitPredictor.advisory_message(smoothed,avg_svc,slowdown)
        density=("HIGH" if smoothed>=DENSITY_HIGH else "MEDIUM" if smoothed>=DENSITY_MED else "LOW")
        if smoothed>=CROWD_THRESHOLD:
            if self.overcrowd_start is None: self.overcrowd_start=now
            elif(now-self.overcrowd_start)>=CROWD_SECONDS: self.overcrowded=True
        else: self.overcrowd_start=None; self.overcrowded=False
        cv=[self.states[t].confidence_score() for t in q_ids if t in self.states]
        avg_conf=round(sum(cv)/len(cv),2) if cv else 0.0
        q_density=round(smoothed/max(1.0,float(queue_polygon.area)/10000.0),2)
        l_integ=line_integrity(self.states,q_ids)
        segs=[0]*DEPTH_SEGS; pmap=[[] for _ in range(DEPTH_SEGS)]
        for t in q_ids:
            s=self.states.get(t)
            if s:
                segs[s.depth_seg]+=1
                pmap[s.depth_seg].append({"track_id":t,"dwell_sec":int(s.dwell),
                    "confidence":round(s.confidence_score(),2),
                    "position":self._qorder.get(t,0),
                    "wait_sec":pw.get(self._qorder.get(t,0),0)})
        surge=self._check_surge(now,smoothed); trend=self._compute_trend(smoothed)
        self._surge_alert=surge
        jnw=WaitPredictor.predict_for_position(smoothed+1,avg_svc,slowdown) if smoothed>0 else 0
        return {
            "canteen_id":CANTEEN_ID,"queue_count":smoothed,"entering_count":len(entering),
            "average_service_seconds":avg_svc,"effective_service_seconds":eff_svc,
            "slowdown_factor":round(slowdown,1),"service_sample_count":len(self.service_times),
            "confidence_score":avg_conf,"queue_density":q_density,
            "line_integrity_score":round(l_integ,2),"density":density,
            "avg_wait_sec":avg_wait,"avg_wait_display":_fmt(avg_wait),
            "predicted_wait_sec":WaitPredictor.predict_for_position(max(1,smoothed),avg_svc,slowdown),
            "predicted_wait_display":_fmt(WaitPredictor.predict_for_position(max(1,smoothed),avg_svc,slowdown)),
            "join_now_wait_sec":jnw,"join_now_wait_display":_fmt(jnw) if jnw>0 else "0s",
            "advisory":advisory,"overcrowded":self.overcrowded,
            "depth_segments":segs,"position_map":pmap,
            "position_waits":{str(k):v for k,v in pw.items()},
            "throughput_per_min":thru,"surge_alert":surge,"trend":trend,
            "front_seg_count":segs[0] if segs else 0,"fps":0.0,"last_updated":int(now),
        }

    def snapshot(self):
        with self._lock: return dict(self._snap)

    @staticmethod
    def _zero():
        return {
            "canteen_id":CANTEEN_ID,"queue_count":0,"entering_count":0,
            "average_service_seconds":DEFAULT_SERVICE,"confidence_score":0.0,
            "queue_density":0.0,"line_integrity_score":0.0,"density":"LOW",
            "avg_wait_sec":0,"avg_wait_display":"0s","predicted_wait_sec":0,
            "predicted_wait_display":"0s","join_now_wait_sec":0,"join_now_wait_display":"0s",
            "advisory":"Queue clear — walk straight to the counter",
            "overcrowded":False,"depth_segments":[0]*DEPTH_SEGS,
            "position_map":[[] for _ in range(DEPTH_SEGS)],"position_waits":{},
            "throughput_per_min":0.0,"surge_alert":False,"trend":"stable",
            "front_seg_count":0,"fps":0.0,"last_updated":int(time.time()),
            "effective_service_seconds":DEFAULT_SERVICE,"slowdown_factor":1.0,"service_sample_count":0,
        }


def _fmt(sec):
    sec=int(sec)
    if sec<=0: return "0s"
    if sec<60: return f"{sec}s"
    m,s=divmod(sec,60)
    return f"{m}m {s}s" if s else f"{m}m"


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 12 — RENDERER  (banners ALWAYS at bottom)
# ══════════════════════════════════════════════════════════════════════════════

def render_frame(frame,display_tracks,metrics,fps,heatmap):
    out=frame.copy()
    overcrowd=metrics["overcrowded"]; surge=metrics.get("surge_alert",False)
    trend=metrics.get("trend","stable"); advisory=metrics.get("advisory","")
    q_count=metrics["queue_count"]; has_tracks=q_count>0
    border=COL_RED if overcrowd else COL_GREEN
    d_col={"LOW":COL_GREEN,"MEDIUM":COL_YELLOW,"HIGH":COL_RED}.get(metrics["density"],COL_WHITE)

    hm=cv2.resize(heatmap.overlay_bgr(),(FRAME_W,FRAME_H))
    cv2.addWeighted(hm,0.10,out,0.90,0,out)
    ov=out.copy(); cv2.fillPoly(ov,[roi_pts_np],(0,45,0) if not overcrowd else(0,0,55))
    cv2.addWeighted(ov,0.16,out,0.84,0,out)
    cv2.polylines(out,[roi_pts_np],True,border,2,cv2.LINE_AA)
    lx,ly=QUEUE_POLY_PTS[0]
    cv2.putText(out,"QUEUE ZONE",(lx+4,ly-8),cv2.FONT_HERSHEY_SIMPLEX,0.52,border,2,cv2.LINE_AA)
    cv2.line(out,(0,STAFF_EXCL_Y),(FRAME_W,STAFF_EXCL_Y),(50,50,50),1)
    cv2.putText(out,"STAFF ZONE",(4,STAFF_EXCL_Y-4),cv2.FONT_HERSHEY_SIMPLEX,0.30,(70,70,70),1)

    roi_top,roi_bot=QUEUE_POLY_PTS[0][1],QUEUE_POLY_PTS[3][1]
    seg_h=(roi_bot-roi_top)/DEPTH_SEGS; segs=metrics.get("depth_segments",[0]*DEPTH_SEGS)
    for i in range(1,DEPTH_SEGS):
        yl=int(roi_top+i*seg_h)
        cv2.line(out,(80,yl),(FRAME_W-80,yl),(40,40,40),1)
        cv2.putText(out,f"{DEPTH_SEG_LABELS[i]}: {segs[i] if i<len(segs) else 0}",
                    (88,yl-4),cv2.FONT_HERSHEY_SIMPLEX,0.30,(70,70,70),1)

    # Bboxes
    pw=metrics.get("position_waits",{})
    for(tid,x1,y1,x2,y2,lbl,dwell,conf,dep,pos) in display_tracks:
        col=(COL_RED if lbl=="queuing" else COL_YELLOW if lbl=="entering" else COL_GREY)
        cv2.rectangle(out,(x1,y1),(x2,y2),col,2)
        cv2.circle(out,((x1+x2)//2,y2),4,col,-1)
        chip=(f"#{pos}  {int(dwell)}s  {int(conf*100)}%" if lbl=="queuing"
              else f"#{tid} entering" if lbl=="entering" else f"#{tid}")
        (tw,th),_=cv2.getTextSize(chip,cv2.FONT_HERSHEY_SIMPLEX,0.42,1)
        cv2.rectangle(out,(x1,y1-th-8),(x1+tw+8,y1),col,-1)
        cv2.putText(out,chip,(x1+4,y1-4),cv2.FONT_HERSHEY_SIMPLEX,0.42,COL_BLACK,1,cv2.LINE_AA)
        if lbl=="queuing" and pos>0:
            ws=pw.get(str(pos),0)
            if ws>0:
                wt=f"~{_fmt(ws)}"; (ww,wh),_=cv2.getTextSize(wt,cv2.FONT_HERSHEY_SIMPLEX,0.36,1)
                cv2.rectangle(out,(x1,y2+2),(x1+ww+6,y2+wh+8),(20,20,20),-1)
                cv2.putText(out,wt,(x1+3,y2+wh+4),cv2.FONT_HERSHEY_SIMPLEX,0.36,COL_CYAN,1,cv2.LINE_AA)

    # ── HUD — top-left, always above banner zone ──────────────────────────
    conf_s=metrics.get("confidence_score",0.0)
    thru=metrics.get("throughput_per_min",0.0)
    trend_sym={"rising":"^","falling":"v","stable":"-"}.get(trend,"-")

    plines=[
        (f"Queue     : {q_count} people  [{trend_sym}]",d_col),
        (f"Entering  : {metrics['entering_count']}",
         COL_YELLOW if metrics['entering_count'] else COL_GREY),
        (f"Density   : {metrics['density']}",d_col),
        (f"Avg Wait  : {metrics['avg_wait_display']}",COL_WHITE),
        ("Join Now  : Clear, walk in" if q_count==0
         else f"Join Now  : {metrics['join_now_wait_display']} wait",
         COL_GREEN if q_count==0 else COL_ORANGE),
        (f"Throughput: {thru}/min",COL_CYAN),
        (f"FPS       : {int(fps)}  [{DEVICE}]",COL_GREY),
    ]
    if has_tracks:
        plines.append((f"Confidence: {int(conf_s*100)}%",COL_CYAN))
        plines.append((f"LineInteg : {int(metrics.get('line_integrity_score',0)*100)}%",COL_CYAN))

    px,py,lh,pw2=10,10,24,300; ph=len(plines)*lh+18
    bg=out.copy(); cv2.rectangle(bg,(px,py),(px+pw2,py+ph),(12,12,12),-1)
    cv2.addWeighted(bg,0.70,out,0.30,0,out)
    for i,(txt,col) in enumerate(plines):
        cv2.putText(out,txt,(px+10,py+20+i*lh),cv2.FONT_HERSHEY_SIMPLEX,0.50,col,2,cv2.LINE_AA)

    if has_tracks:
        bar_y=py+ph+6; cv2.rectangle(out,(px,bar_y),(px+pw2,bar_y+7),(28,28,28),-1)
        fill=int(pw2*min(1.0,conf_s))
        bcol=COL_GREEN if conf_s>0.7 else COL_YELLOW if conf_s>0.4 else COL_RED
        if fill>0: cv2.rectangle(out,(px,bar_y),(px+fill,bar_y+7),bcol,-1)
        cv2.putText(out,"CONF",(px+pw2+4,bar_y+7),cv2.FONT_HERSHEY_SIMPLEX,0.30,COL_GREY,1)

    # Legend — above banner, bottom-right
    bx=FRAME_W-230; by=FRAME_H-BANNER_H-78
    bg2=out.copy()
    cv2.rectangle(bg2,(bx-6,by-14),(FRAME_W-4,FRAME_H-BANNER_H-4),(12,12,12),-1)
    cv2.addWeighted(bg2,0.60,out,0.40,0,out)
    for i,(col,txt) in enumerate([(COL_RED,"Counted in queue"),
                                   (COL_YELLOW,"Entering (warmup)"),
                                   (COL_GREY,"Outside / walking")]):
        yy=by+i*20; cv2.circle(out,(bx+6,yy),5,col,-1)
        cv2.putText(out,txt,(bx+16,yy+5),cv2.FONT_HERSHEY_SIMPLEX,0.34,COL_WHITE,1,cv2.LINE_AA)

    # ── BANNERS — pinned to very bottom of frame ──────────────────────────
    by2=FRAME_H-BANNER_H
    if overcrowd:
        pulse=0.55+0.25*abs((time.time()%1.0)-0.5)
        bnr=out.copy(); cv2.rectangle(bnr,(0,by2),(FRAME_W,FRAME_H),(0,0,155),-1)
        cv2.addWeighted(bnr,pulse,out,1-pulse,0,out)
        cv2.putText(out,"  WARNING: QUEUE OVERCROWDED — WAIT TIMES EXTENDED",
                    (10,by2+26),cv2.FONT_HERSHEY_SIMPLEX,0.55,COL_WHITE,2,cv2.LINE_AA)
    elif surge:
        pulse=0.55+0.25*abs((time.time()%1.0)-0.5)
        bnr=out.copy(); cv2.rectangle(bnr,(0,by2),(FRAME_W,FRAME_H),(0,100,200),-1)
        cv2.addWeighted(bnr,pulse,out,1-pulse,0,out)
        cv2.putText(out,"  SURGE DETECTED — QUEUE GROWING FAST",
                    (10,by2+26),cv2.FONT_HERSHEY_SIMPLEX,0.55,COL_WHITE,2,cv2.LINE_AA)
    else:
        adv_bg=out.copy()
        adv_col=(0,100,40) if q_count==0 else(30,70,130)
        cv2.rectangle(adv_bg,(0,by2),(FRAME_W,FRAME_H),adv_col,-1)
        cv2.addWeighted(adv_bg,0.80,out,0.20,0,out)
        cv2.putText(out,f"  {advisory}",
                    (10,by2+26),cv2.FONT_HERSHEY_SIMPLEX,0.50,COL_WHITE,1,cv2.LINE_AA)

    return out


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 13 — BACKEND PUSH
# ══════════════════════════════════════════════════════════════════════════════

def push_backend(m):
    def _go():
        try:
            import requests
            requests.post(BACKEND_URL,timeout=1.5,json={
                "canteen_id":CANTEEN_ID,"queue_count":m["queue_count"],
                "average_service_seconds":m["average_service_seconds"],
                "density":m["density"],"overcrowded":m["overcrowded"],
                "predicted_wait_seconds":m["predicted_wait_sec"],
                "join_now_wait_seconds":m["join_now_wait_sec"],
                "advisory":m["advisory"],"confidence_score":m["confidence_score"],
                "line_integrity_score":m["line_integrity_score"],
                "queue_density":m["queue_density"],"throughput_per_min":m["throughput_per_min"],
                "surge_alert":m["surge_alert"],"trend":m["trend"],
                "depth_segments":m["depth_segments"],"front_seg_count":m["front_seg_count"],
            })
        except Exception: pass
    threading.Thread(target=_go,daemon=True).start()


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 14 — FASTAPI :9000
# ══════════════════════════════════════════════════════════════════════════════

_analytics=QueueAnalytics()

def _start_api():
    try:
        from fastapi import FastAPI,Query
        from fastapi.middleware.cors import CORSMiddleware
        import uvicorn
        api=FastAPI(title="Queue Intelligence v3.1")
        api.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])

        @api.get("/queue/snapshot")
        def snapshot(): return _analytics.snapshot()

        @api.get("/queue/my-wait")
        def my_wait(position:int=Query(default=None,ge=1)):
            s=_analytics.snapshot()
            avg_svc=s["average_service_seconds"]; slowdown=s["slowdown_factor"]
            if position is None: position=s["queue_count"]+1
            ws=WaitPredictor.predict_for_position(position,avg_svc,slowdown)
            return {"canteen_id":CANTEEN_ID,"your_position":position,
                    "wait_seconds":ws,"wait_display":_fmt(ws),
                    "wait_minutes":int(ws/60),"queue_count":s["queue_count"],
                    "advisory":WaitPredictor.advisory_message(s["queue_count"],avg_svc,slowdown),
                    "last_updated":s["last_updated"]}

        @api.get("/queue/position-map")
        def position_map():
            s=_analytics.snapshot()
            return {"canteen_id":s["canteen_id"],"last_updated":s["last_updated"],
                    "segments":[{"segment_index":i,"label":DEPTH_SEG_LABELS[i],
                                 "count":s["depth_segments"][i],
                                 "people":s["position_map"][i] if i<len(s["position_map"]) else []}
                                for i in range(DEPTH_SEGS)],
                    "total":s["queue_count"],"trend":s["trend"],
                    "throughput_per_min":s["throughput_per_min"],"advisory":s["advisory"]}

        @api.get("/health")
        def health(): return{"ok":True,"device":DEVICE,"model":MODEL_PATH}

        print("[API] http://localhost:9000/queue/snapshot")
        uvicorn.run(api,host="0.0.0.0",port=9000,log_level="warning")
    except Exception as e: print(f"[API] {e}")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 15 — INIT
# ══════════════════════════════════════════════════════════════════════════════

print(f"[INIT] Loading {MODEL_PATH} on {DEVICE}...")
model=YOLO(MODEL_PATH)
model(np.zeros((FRAME_H,FRAME_W,3),dtype=np.uint8),verbose=False)
print("[INIT] Warm-up done")

tracker=DeepSort(max_age=DS_MAX_AGE,n_init=DS_N_INIT,max_iou_distance=DS_MAX_IOU_DIST,
                 max_cosine_distance=DS_MAX_COSINE_DIST,nn_budget=DS_NN_BUDGET,
                 embedder="mobilenet",half=False,bgr=True)

queue_polygon=Polygon(QUEUE_POLY_PTS)
roi_pts_np=np.array(QUEUE_POLY_PTS,dtype=np.int32).reshape((-1,1,2))
_tnms=TemporalNMS()


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 16 — MAIN LOOP
# ══════════════════════════════════════════════════════════════════════════════

def main():
    threading.Thread(target=_start_api,daemon=True).start()
    stream=RTSPStream(RTSP_URL); frame_idx=0
    fps_buf=deque(maxlen=30); fps=0.0
    last_detect_time=time.time(); last_push_time=0.0
    last_raw_frame=None; last_display=[]; last_metrics=_analytics.snapshot()
    WIN="Smart Canteen — Queue Intelligence v3.1"
    cv2.namedWindow(WIN,cv2.WINDOW_NORMAL); cv2.resizeWindow(WIN,FRAME_W,FRAME_H)
    cv2.setWindowProperty(WIN,cv2.WND_PROP_FULLSCREEN,cv2.WINDOW_FULLSCREEN)
    print("[MAIN] Q/ESC=quit  F=fullscreen  R=print metrics  H=toggle heatmap")
    show_heatmap=True

    while True:
        ok,raw=stream.read()
        if not ok or raw is None:
            if last_raw_frame is None: time.sleep(0.01); continue
            raw=last_raw_frame
        else: last_raw_frame=raw
        frame=cv2.resize(raw,(FRAME_W,FRAME_H)); frame_idx+=1

        if frame_idx%DETECT_EVERY_N==0:
            now=time.time(); elapsed=now-last_detect_time
            if elapsed>0: fps_buf.append(1.0/elapsed); fps=sum(fps_buf)/len(fps_buf)
            last_detect_time=now
            dets=run_detection(frame); raw_tracks=tracker.update_tracks(dets,frame=frame)
            last_display,last_metrics=_analytics.process(raw_tracks,now)
            last_metrics["fps"]=round(fps,0)
            if now-last_push_time>=PUSH_INTERVAL: push_backend(last_metrics); last_push_time=now

        fake_hm=type("H",(),{"overlay_bgr":staticmethod(
            lambda:np.zeros((FRAME_H,FRAME_W,3),np.uint8))})()
        vis=render_frame(frame,last_display,last_metrics,fps,
                         _analytics.heatmap if show_heatmap else fake_hm)
        cv2.imshow(WIN,vis)
        key=cv2.waitKey(1)&0xFF
        if key in(ord("q"),27): break
        elif key==ord("f"):
            prop=cv2.getWindowProperty(WIN,cv2.WND_PROP_FULLSCREEN)
            cv2.setWindowProperty(WIN,cv2.WND_PROP_FULLSCREEN,
                cv2.WINDOW_NORMAL if prop==cv2.WINDOW_FULLSCREEN else cv2.WINDOW_FULLSCREEN)
        elif key==ord("r"): print("[METRICS]",json.dumps(last_metrics,indent=2,default=str))
        elif key==ord("h"): show_heatmap=not show_heatmap

    stream.stop(); cv2.destroyAllWindows(); print("[MAIN] Shutdown")

if __name__=="__main__": main()