import pathlib,json,csv,sys
w=pathlib.Path(__file__).parent; rn=sys.argv[1]; n=int(rn[1:])
votes=list(csv.DictReader((w/(rn+'-codex.tsv')).open(encoding='utf-8'),delimiter='\t'))
resp=json.loads((w/(rn+'.json')).read_text(encoding='utf-8'))['matches']
assert len(votes)==len(resp)
respath=w/(rn+'-resolution.json'); resolutions=json.loads(respath.read_text(encoding='utf-8')) if respath.exists() else {}
pairs=([{'match':f'R1-{i:02d}','a':f'C{i:02d}','b':f'L{i:02d}'} for i in range(1,51)] if n==1 else json.loads((w/(rn+'-pairs.json')).read_text(encoding='utf-8')))
records=[]
for p,v,c in zip(pairs,votes,resp):
 assert p['match']==v['match']==c['match']; assert c['winner'] in [p['a'],p['b']]
 disagree=v['winner']!=c['winner']; assert (c['stance']=='challenge')==disagree
 if disagree:
  r=resolutions[p['match']]
  if r['winner']!=c['winner']:
   follow=json.loads((w/r['claude_followup']).read_text(encoding='utf-8'))
   assert follow['match']==p['match'] and follow['winner']==r['winner'] and follow['concede'] is True
   concession='Claude'; response=r['codex_response']+' | Claude 추가회신: '+follow['reason']
  else: concession='Codex'; response=r['codex_response']
  final=r['winner']
 else: final=c['winner']; response='Codex 유지, Claude agree 확인'; concession='양측 일치'
 records.append({**p,'codex_initial':v['winner'],'codex_reason':v['reason'],'claude_choice':c['winner'],'claude_reason':c['reason'],'condition':c['condition'],'codex_response':response,'concession':concession,'winner':final})
survivors=[x['winner'] for x in records]
prev_bye=w/(rn+'-bye.json')
if prev_bye.exists(): survivors+=json.loads(prev_bye.read_text(encoding='utf-8'))
assert len(set(survivors))==len(survivors)
(w/(rn+'-settled.json')).write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
(w/(rn+'-survivors.json')).write_text(json.dumps(survivors),encoding='utf-8')
nextn='r'+str(n+1)
newpairs=[{'match':f'R{n+1}-{i//2+1:02d}','a':survivors[i],'b':survivors[i+1]} for i in range(0,len(survivors)-1,2)]
(w/(nextn+'-pairs.json')).write_text(json.dumps(newpairs,indent=2),encoding='utf-8')
bye=survivors[-1:] if len(survivors)%2 and len(survivors)>1 else []
if bye:(w/(nextn+'-bye.json')).write_text(json.dumps(bye),encoding='utf-8')
allideas=json.loads((w/'all100.json').read_text(encoding='utf-8'))
for p in newpairs: print(p['match'],p['a'],allideas[p['a']]['name'], '|',p['b'],allideas[p['b']]['name'])
print('bye',bye,'settled',len(records),'challenges',len(resolutions))
