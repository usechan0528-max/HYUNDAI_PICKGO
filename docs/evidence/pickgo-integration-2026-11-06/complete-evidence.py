import json,hashlib,subprocess
from pathlib import Path
out=Path('docs/evidence/pickgo-integration-2026-11-06')
adb='work/pleos-environment/android-sdk/platform-tools/adb.exe'
r=lambda *args:subprocess.check_output([adb,'-s','emulator-5556',*args]).decode('utf-8').strip()
m=json.loads((out/'environment.json').read_text(encoding='utf-8-sig'))
m.update(deviceDate=r('shell','date'),reverse=r('reverse','--list'),serverStartedKST='2026-11-06T00:34:14.676031+09:00',apkBuiltUTC='2026-11-05T15:35:24.4053749Z',navigationScreenshotUTC='2026-11-05T15:39:01.054201Z')
m['deviceClock']='Device PST (UTC-8); report KST (UTC+9); 17-hour timezone difference, not an old execution.'
m['sourceSHA256']={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path('experiments/pickup-board/server.mjs'),Path('experiments/pickup-board/multi/board.mjs'),Path('experiments/pickup-board/multi/planner.mjs'),Path('experiments/pickup-board/domain.mjs')]}
(out/'environment.json').write_text(json.dumps(m,indent=2),encoding='utf-8')
log=(out/'runtime-full.log').read_text(encoding='utf-8-sig')
assert log.count('REQUEST_ROUTE_SENT')==1 and log.count('USER_START')==1
s=json.loads((out/'summary.json').read_text())
s.update(fullPidRouteRequests=log.count('REQUEST_ROUTE_SENT'),fullPidUserStarts=log.count('USER_START'),apkSHA256=m['installedSHA256'],serverHead=m['head'],scope='One emulator acceptance run; booleans follow completed assertions, navigation tap count reflects harness actions, not OS-wide input surveillance.')
(out/'summary.json').write_text(json.dumps(s,indent=2),encoding='utf-8')
