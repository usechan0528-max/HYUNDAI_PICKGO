from pathlib import Path
from PIL import Image
import json
out=Path('docs/evidence/pickgo-design-review-2026-11-06');src=Path('docs/showcase/screenshots')
crops={'coordinate':('07-ready-driver.png',(40,320,780,480)), 'mobile-actions':('20-multi-rider.png',(16,233,374,468)), 'shared-stop':('21-shared-stop.png',(30,395,1250,960)), 'end-action':('15-boarded.png',(40,130,1240,570)), 'candidate-labels':('03-candidates.png',(240,285,1040,590))}
for name,(f,box) in crops.items():
 im=Image.open(src/f).crop(box);im.resize((im.width*2,im.height*2)).save(out/(name+'-2x.png'))
(out/'crop-manifest.json').write_text(json.dumps(crops,indent=2),encoding='utf-8')
