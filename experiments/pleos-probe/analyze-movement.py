"""Summarize captured SDK outputs; never replace missing values with fixtures."""
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = root / 'docs/evidence'
result = {'environment': 'Pleos 2.1.0 API34 emulator-5556; actual SDK services, synthetic GPS',
          'fusedSdk': '1.1.3', 'naviSdk': '3.0.5', 'runs': {}}
for run in ('first', 'second'):
    path = evidence / f'pleos-movement-{run}-runtime-2026-11-02.txt'
    log = path.read_text(encoding='utf-8-sig')
    fused = re.findall(r' LOCATION_CHANGE changed=(true|false) changes=\d+ syntheticFixture=(-?\d+)', log)
    nav = re.findall(r' NAVI_LOCATION_CHANGE baseline=(true|false) changed=(true|false) syntheticFixture=(-?\d+)', log)
    times = [int(n) for n in re.findall(r'DESTINATION_TIME remainTimeRaw=(-?\d+)', log)]
    stamps = [int(n) for n in re.findall(r'PleosProbe: (\d+) ', log)]
    result['runs'][run] = {
        'logSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'observationSpanSeconds': (max(stamps)-min(stamps))/1000 if stamps else None,
        'fusedSamples': len(fused), 'fusedChanges': sum(row[0]=='true' for row in fused),
        'fusedMatchedFixtures': sorted({int(row[1]) for row in fused if int(row[1])>=0}),
        'naviLocationSamples': len(nav), 'naviLocationChanges': sum(row[1]=='true' for row in nav),
        'naviMatchedFixtures': sorted({int(row[2]) for row in nav if int(row[2])>=0}),
        'destinationSamples': len(times), 'destinationUniqueRawTimes': sorted(set(times)),
        'destinationTimeChanges': sum(a!=b for a,b in zip(times,times[1:])),
        'routeStates': sorted(set(re.findall(r'ROUTE_STATUS mode=(\w+) routing=(\w+)',log))),
        'errors': re.findall(r'^.*(?:ERROR|Exception).*$',log,re.M),
    }
result['conclusion'] = 'Fused movement confirmed; navigation location and ETA changes NOT confirmed.'
result['limits'] = ['Synthetic straight path, not verified road route; no vehicle dynamics test.',
                    'First run did not compare navigation coordinates.',
                    'No real vehicle or ETA accuracy verification.']
apk = root / 'experiments/pleos-probe/app/build/outputs/apk/debug/app-debug.apk'
result['apkSha256'] = hashlib.sha256(apk.read_bytes()).hexdigest()
out = evidence / 'pleos-movement-result-2026-11-02.json'
out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
print(json.dumps(result, indent=2, ensure_ascii=False))
