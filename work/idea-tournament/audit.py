import pathlib,json,csv,hashlib,collections
w=pathlib.Path(__file__).parent
ideas=json.loads((w/'all100.json').read_text(encoding='utf-8'))
assert len(ideas)==100
assert set(ideas)=={f'{p}{i:02d}' for p in ['C','L'] for i in range(1,51)}
records=[]; byes=[]; rounds=[]
expected=set(ideas)
for n in range(1,8):
 rn='r'+str(n)
 rows=json.loads((w/(rn+'-settled.json')).read_text(encoding='utf-8'))
 bye=json.loads((w/(rn+'-bye.json')).read_text(encoding='utf-8')) if (w/(rn+'-bye.json')).exists() else []
 participants=[v for r in rows for v in [r['a'],r['b']]]+bye
 assert len(participants)==len(set(participants)) and set(participants)==expected
 assert all(r['winner'] in [r['a'],r['b']] for r in rows)
 expected={r['winner'] for r in rows}|set(bye)
 assert expected==set(json.loads((w/(rn+'-survivors.json')).read_text(encoding='utf-8')))
 records+=rows; byes+=bye
 rounds.append({'round':n,'matches':len(rows),'byes':bye,'survivors':len(expected)})
assert len(records)==99 and len(expected)==1 and len(byes)==3
losers=[r['b'] if r['winner']==r['a'] else r['a'] for r in records]
assert len(set(losers))==99 and set(losers)|expected==set(ideas)
models=[]
for p in sorted(w.glob('*-meta.json')):
 m=json.loads(p.read_text(encoding='utf-8'))
 assert m['exit']==0 and m['is_error'] is False and 'parse_error' not in m and 'error' not in m
 assert 'claude-opus-5-5' in m['modelUsage']
 models.append({'call':p.name.removesuffix('-meta.json'),'session_id':m['session_id'],'model':'claude-opus-5-5'})
report={'status':'PASS','original_submissions':100,'codex':50,'claude':50,'note':'100개 원본 제안이며 서로 유사한 문제/변형 포함. 100개 시장독창성 주장 아님.','rounds':rounds,'matches':99,'byes':byes,'winner':next(iter(expected)),'concessions':dict(collections.Counter(r['concession'] for r in records)),'actual_claude_calls':models,'original_hashes':{name:hashlib.sha256((w/name).read_bytes()).hexdigest() for name in ['codex50.tsv','claude50.json']},'not_validated':['사용자 수요','기존 서비스 대비 실측 우위','Gleo schema 승인/음성 실행','실차 안전/동작','전세계 앱 전수목록']}
(w/'audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
