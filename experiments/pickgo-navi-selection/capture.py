"""Capture only this emulator's UI and this probe's SDK logs; no logcat clearing."""
from pathlib import Path
import subprocess, sys, xml.etree.ElementTree as ET
root = Path(__file__).resolve().parents[2]
adb = root / 'work/pleos-environment/android-sdk/platform-tools/adb.exe'
out = root / 'docs/evidence/pickgo-navi-selection-2026-11-04'
out.mkdir(exist_ok=True)
label = sys.argv[1]
def call(*args):
    return subprocess.run([str(adb), '-s', 'emulator-5556', *args], capture_output=True, check=True).stdout
call('shell', 'uiautomator', 'dump', '/sdcard/pickgo-selection.xml')
xml = call('shell', 'cat', '/sdcard/pickgo-selection.xml')
(out / (label+'.xml')).write_bytes(xml)
(out / (label+'.png')).write_bytes(call('exec-out','screencap','-p'))
log = call('logcat','-d','-v','threadtime','PickgoNaviProbe:I','AndroidRuntime:E','*:S')
(out / (label+'.log')).write_bytes(log)
for node in ET.fromstring(xml).iter('node'):
    name = node.get('text') or node.get('content-desc')
    if name: print(name, node.get('bounds'))
print(log.decode('utf-8',errors='replace')[-4500:])
