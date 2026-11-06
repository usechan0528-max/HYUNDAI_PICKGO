from pathlib import Path
from PIL import Image,ImageDraw
import subprocess,imageio_ffmpeg,json,hashlib
out=Path('docs/evidence/pickgo-design-review-2026-11-06'); src=Path('docs/showcase/screenshots')
files=sorted(src.glob('*'))
manifest={str(p):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':Image.open(p).size} for p in files}
v=Path('docs/showcase/video/PICKGO_DEMO.mp4'); manifest[str(v)]={'sha256':hashlib.sha256(v.read_bytes()).hexdigest()}
(out/'source-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
def sheet(paths,name,w=800,h=600):
 im=Image.new('RGB',(w*2,(h+32)*((len(paths)+1)//2)), '#383838');d=ImageDraw.Draw(im)
 for i,p in enumerate(paths):
  pic=Image.open(p).convert('RGB');pic.thumbnail((w,h));x=(i%2)*w;y=(i//2)*(h+32);d.text((x+8,y+7),p.stem,fill='white');im.paste(pic,(x,y+32))
 im.save(out/name)
for i in range(0,len(files),4): sheet(files[i:i+4],f'screens-{i//4+1:02}.jpg',900,720)
ff=imageio_ffmpeg.get_ffmpeg_exe(); times=[0,5,6]+list(range(8,99,4))+[99,102,106,110,114,118,119,122,125]
for t in times:
 subprocess.run([ff,'-hide_banner','-loglevel','error','-ss',str(t),'-i',str(v),'-frames:v','1','-y',str(out/f'video-{t:03}.jpg')],check=True)
for i in range(0,len(times),4):sheet([out/f'video-{t:03}.jpg' for t in times[i:i+4]],f'video-sheet-{i//4+1:02}.jpg',960,540)
(out/'frame-times.json').write_text(json.dumps(times));print(json.dumps(manifest,indent=2))
