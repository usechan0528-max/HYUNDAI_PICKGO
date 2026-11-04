"""Emulator-only evidence. Never writes credentials or invite URLs to console."""
from pathlib import Path
import subprocess,sys,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
adb=root/'work/pleos-environment/android-sdk/platform-tools/adb.exe'
out=root/'docs/evidence/pickgo-navigation-2026-11-04'
out.mkdir(exist_ok=True)
def call(*args):
 return subprocess.run([str(adb),'-s','emulator-5556',*args],capture_output=True,check=True).stdout
if __name__=='__main__':
 label=sys.argv[1]
 call('shell','uiautomator','dump','/sdcard/pickgo-navigation.xml')
 xml=call('shell','cat','/sdcard/pickgo-navigation.xml')
 (out/(label+'.xml')).write_bytes(xml)
 (out/(label+'.png')).write_bytes(call('exec-out','screencap','-p'))
 (out/(label+'.log')).write_bytes(call('logcat','-d','-v','threadtime','PickgoNavigation:I','AndroidRuntime:E','*:S'))
 for n in ET.fromstring(xml).iter('node'):
  name=n.get('text') or n.get('content-desc')
  if name and 'invite=' not in name: print(name,n.get('bounds'),'enabled='+n.get('enabled',''))
