import pathlib,re,json
w=pathlib.Path(__file__).parent
paths=[w.parents[1]/'docs/IDEA_TOURNAMENT_2026-11-02.md',w/'catalogue.md',w/'matches.md']
bad=[]
for p in paths:
 for target in re.findall(r'\]\(([^)]+)\)',p.read_text(encoding='utf-8')):
  if target.startswith(('https:','http:','#')): continue
  if not (p.parent/target.split('#')[0]).exists(): bad.append({'file':str(p),'target':target})
assert not bad,bad
r={'status':'PASS','checks':['report/catalogue/matches local links resolve'],'files':[str(p) for p in paths]}
(w/'document-check.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(r,ensure_ascii=False))
