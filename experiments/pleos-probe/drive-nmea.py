"""Replay synthetic GPS through the documented emulator NMEA console input."""
import datetime
import argparse
import json
import subprocess
import time
from pathlib import Path

root = Path(__file__).resolve().parents[2]
adb = root / 'work/pleos-environment/android-sdk/platform-tools/adb.exe'
base = [str(adb), '-s', 'emulator-5556']
if subprocess.check_output(base + ['shell', 'getprop', 'ro.hardware'], text=True).strip() != 'ranchu':
    raise SystemExit('Only the test ranchu AVD is allowed')

def sentence(body):
    checksum = 0
    for char in body:
        checksum ^= ord(char)
    return f'${body}*{checksum:02X}'

def degrees(value, width):
    whole = int(value)
    return f'{whole:0{width}d}{(value-whole)*60:07.4f}'

parser = argparse.ArgumentParser()
parser.add_argument('--steps', type=int, default=61, choices=range(1,62))
args = parser.parse_args()
rows = []
for i in range(args.steps):
    # Synthetic northbound movement, approx. 11 m/s. Not measured road driving.
    lat, lon = 37.4000 + i * .0001, 127.1000
    now = datetime.datetime.now(datetime.timezone.utc)
    # Goldfish GNSS parses HHMMSS as an integer followed directly by a comma.
    stamp = now.strftime('%H%M%S')
    fields = f'{degrees(lat,2)},N,{degrees(lon,3)},E'
    bodies = [f'GPGGA,{stamp},{fields},1,08,0.9,30.0,M,0.0,M,,',
              f'GPRMC,{stamp},A,{fields},21.6,0.0,{now:%d%m%y},0.0,W,A']
    # Keep the passive emulator provider at the same synthetic point.
    fix = subprocess.run(base + ['emu','geo','fix',str(lon),str(lat),'30','8','21.6'],capture_output=True,text=True,timeout=10)
    if fix.returncode or 'KO:' in fix.stdout:
        raise SystemExit('geo fix rejected')
    for body in bodies:
        r = subprocess.run(base + ['emu', 'geo', 'nmea', sentence(body)], capture_output=True, text=True, timeout=10)
        if r.returncode or 'KO:' in r.stdout:
            raise SystemExit(f'NMEA rejected at step {i}: {r.stdout} {r.stderr}')
    rows.append({'step': i, 'hostMonotonic': time.monotonic(), 'nmeaUtc': stamp,
                 'consoleCommandsAccepted': 3, 'sdkAcceptance': 'not asserted'})
    print(json.dumps(rows[-1]), flush=True)
    (root/'work/pleos-environment/nmea-input.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
    time.sleep(1)
