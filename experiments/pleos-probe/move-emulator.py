"""Send synthetic GPS fixes to one verified ranchu AVD; does not manufacture SDK results."""
import json
import subprocess
import time
from pathlib import Path

root = Path(__file__).resolve().parents[2]
adb = root / 'work/pleos-environment/android-sdk/platform-tools/adb.exe'
base = [str(adb), '-s', 'emulator-5556']
hardware = subprocess.check_output(base + ['shell', 'getprop', 'ro.hardware'], text=True).strip()
if hardware != 'ranchu':
    raise SystemExit('Refusing non-ranchu device')
results = []
for i in range(11):
    command = base + ['emu', 'geo', 'fix', '127.100000', f'{37.4000 + i * .0002:.6f}', '30', '8', '5.4']
    result = subprocess.run(command, capture_output=True, text=True, timeout=15)
    row = {'fixture': i, 'hostMonotonic': time.monotonic(), 'exitCode': result.returncode,
           'stdout': result.stdout.strip(), 'stderr': result.stderr.strip()}
    results.append(row)
    print(json.dumps(row), flush=True)
    (root / 'work/pleos-environment/movement-input.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    if result.returncode or 'KO:' in result.stdout:
        raise SystemExit('GPS command rejected; inspect input log')
    time.sleep(8)
