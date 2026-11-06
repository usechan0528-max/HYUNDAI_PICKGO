from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import json, subprocess, itertools, math
import imageio_ffmpeg
root=Path('work/pickgo-showcase'); out=Path('docs/showcase/video'); shots=Path('docs/showcase/screenshots')
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
fontpath='C:/Windows/Fonts/malgun.ttf'; boldpath='C:/Windows/Fonts/malgunbd.ttf'
def font(n,bold=False):return ImageFont.truetype(boldpath if bold else fontpath,n)
bg='#101514'; fg='#f4f5ef'; muted='#aebcb4'; green='#b8edca'
def text(im,xy,t,n=30,color=fg,bold=False):ImageDraw.Draw(im).text(xy,t,font=font(n,bold),fill=color)
def wrap(s,maxwidth,n=30):
    lines=[''];f=font(n)
    for c in s:
        if f.getlength(lines[-1]+c)>maxwidth:lines.append(c)
        else:lines[-1]+=c
    return lines
def fit(im,source,box):
    x,y,w,h=box;s=ImageOps.contain(source.convert('RGB'),(w,h),Image.Resampling.LANCZOS);im.paste(s,(x+(w-s.width)//2,y+(h-s.height)//2))
def base(chapter,caption):
    im=Image.new('RGB',(1920,1080),bg);dr=ImageDraw.Draw(im);dr.rectangle((0,0,12,1080),fill=green)
    text(im,(42,22),'PICKGO',38,green,True);text(im,(280,34),chapter,28)
    dr.line((40,88,1880,88),fill='#34463b',width=2)
    for i,line in enumerate(wrap(caption,1800,30)):text(im,(52,966+i*40),line,30)
    return im
def frame(driver,rider,chapter,caption):
    im=base(chapter,caption);text(im,(52,105),'운전자 화면',24,muted);text(im,(1500,105),'탑승자 화면 · 모바일 크기 브라우저',18,muted)
    fit(im,driver,(42,150,1400,790));fit(im,rider,(1480,150,390,790));return im
def card(title,sub,lines):
    im=base('공모전 앱 시연 · 로컬 프로토타입','가상 인물 시나리오 · 실제 앱 화면 · 주행 중 조작 금지')
    text(im,(100,235),title,80,fg,True);text(im,(104,360),sub,39,green)
    for i,line in enumerate(lines):text(im,(108,535+70*i),line,30,muted)
    return im
intro=card('만날 장소부터 모두의 탑승까지','PICKGO  /  운전자와 동행이 함께 확인하는 픽업 약속판',[
    '01   장소 검색 → 초대 → 준비 → 장소 변경 합의 → 도착·탑승',
    '02   세 명을 두 지점에서 픽업 · 공동 지점의 사람별 확인',
    '03   별도 Pleos 에뮬레이터의 실제 NaviHelper 안내 연결'])
intro.save(out/'poster.jpg',quality=94)
overview=frame(Image.open(shots/'07-ready-driver.png'),Image.open(shots/'08-ready-rider.png'),'만날 장소와 준비 상태를 함께 확인','장소 합의 · 준비 확인 · 도착 알림 · 탑승 완료')
overview.save(shots/'00-overview.jpg',quality=94)
timeline=json.loads((root/'timeline.json').read_text(encoding='utf-8'))
fps=4;encoded=0;chapters=[];captions=[]
proc=subprocess.Popen([ffmpeg,'-y','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r',str(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-r','24','-movflags','+faststart',str(out/'PICKGO_DEMO.mp4')],stdin=subprocess.PIPE,stderr=(root/'encode.log').open('w'))
def emit(im,n=1):
    global encoded
    data=im.tobytes()
    for _ in range(n):proc.stdin.write(data);encoded+=1
def mark(title):chapters.append((encoded/fps,title))
mark('소개');emit(intro,6*fps)
last=None
for (chapter,caption),group in itertools.groupby(timeline,key=lambda x:(x['chapter'],x['caption'])):
    group=list(group)
    group=[x for x in group if (root/'frames'/f"{x['i']}-d.jpg").exists() and (root/'frames'/f"{x['i']}-r.jpg").exists()]
    if not group:continue
    if chapter!=last:mark(chapter);last=chapter
    # Keep each explanation readable; remove long capture/transition stalls.
    seconds=max(4,min(9,len(group)/fps));n=round(seconds*fps);start=encoded/fps
    for j in range(n):
        item=group[min(len(group)-1,math.floor(j*len(group)/n))];i=item['i']
        im=frame(Image.open(root/'frames'/f'{i}-d.jpg'),Image.open(root/'frames'/f'{i}-r.jpg'),chapter,caption);emit(im)
    captions.append((start,encoded/fps,caption))
mark('03 / 현대 내비 연결 · 별도 촬영')
native_intro=card('확정한 지점을 현대 내비로','별도 Android 앱 · Pleos 에뮬레이터 · NaviHelper 3.0.5',[
    '다음 장면은 2026-11-04 검증 녹화 일부입니다.',
    '최신 웹 화면과 동일 회차·동일 빌드의 연속 촬영본이 아닙니다.',
    '실차 검증 아님 · 다중 경유 안내 미연결'])
emit(native_intro,5*fps)
native_dir=root/'native-frames';native_dir.mkdir(exist_ok=True)
subprocess.run([ffmpeg,'-y','-ss','10','-i','docs/evidence/pickgo-navigation-2026-11-04/reviewed-demo.mp4','-t','16','-vf','fps=4,scale=1600:-2','-q:v','2',str(native_dir/'%04d.jpg')],capture_output=True,check=True)
for p in sorted(native_dir.glob('*.jpg')):
    im=base('03 / 실제 NaviHelper 연결 · 2026-11-04 별도 촬영','명시적 안내 시작 → 현대 내비 경로 화면 · 에뮬레이터 증거 / 실차 검증 아님')
    fit(im,Image.open(p),(170,115,1580,815));emit(im)
mark('구현 범위와 마무리')
end=card('함께 정하고, 함께 확인하는 픽업','PICKGO',[
    '구현: 단일·다인 픽업의 장소·초대·준비·도착·탑승 관리',
    '별도 검증: Android / Pleos 에뮬레이터의 단일 목적지 안내',
    '미완료: 실차·차량 UX 제한·공개 HTTPS·실제 도로시간·다중 경유',
    '전체 기능과 실행 방법: README · 사용 설명서'])
emit(end,7*fps);proc.stdin.close();assert proc.wait()==0
def stamp(t):return f'{int(t)//60:02}:{int(t)%60:02}'
def srtstamp(t):return f'{int(t)//3600:02}:{int(t)//60%60:02}:{int(t)%60:02},{int(t%1*1000):03}'
(out/'PICKGO_DEMO.ko.srt').write_text('\n\n'.join(f'{i+1}\n{srtstamp(a)} --> {srtstamp(b)}\n{c}' for i,(a,b,c) in enumerate(captions))+'\n',encoding='utf-8')
(out/'VIDEO_INFO.md').write_text('# 시연 영상 정보\n\n- 파일: `PICKGO_DEMO.mp4`\n- 규격: 1920×1080, H.264 / yuv420p, 24fps 출력, 무음·한국어 화면 설명.\n- 웹 원본: 실제 UI 화면을 약 4fps 이하로 캡처하여 편집. 24fps 실시간 원본 녹화를 뜻하지 않음.\n- 길이: '+stamp(encoded/fps)+f' ({encoded/fps:.2f}초).\n- 실제 사용자 개인정보·음성·음악 미사용.\n- 지도 출처 표시 유지.\n- native 구간: `docs/evidence/pickgo-navigation-2026-11-04/reviewed-demo.mp4` 10~26초 발췌.\n\n## 장면\n\n'+'\n'.join(f'- {stamp(t)} — {name}' for t,name in chapters)+'\n',encoding='utf-8')
(root/'render-summary.json').write_text(json.dumps({'seconds':encoded/fps,'frames':encoded,'chapters':chapters},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'seconds':encoded/fps,'frames':encoded,'chapters':chapters},ensure_ascii=True))
