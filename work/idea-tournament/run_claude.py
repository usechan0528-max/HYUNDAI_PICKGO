import pathlib, subprocess, sys, json, datetime
w=pathlib.Path(__file__).parent
name=sys.argv[1]
prompt=(w/(name+'-input.txt')).read_text(encoding='utf-8')
exe=r'C:\Users\dldyd\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\claude-code\2.1.308\c17a819afb40\claude.exe'
args=[exe,'--safe-mode','--print','--tools','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--permission-mode','plan','--output-format','json','--model','claude-opus-5-5','--effort','high']
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
r=subprocess.run(args,input=prompt,text=True,encoding='utf-8',capture_output=True,timeout=900)
(w/(name+'-raw.json')).write_text(r.stdout,encoding='utf-8')
(w/(name+'-stderr.txt')).write_text(r.stderr,encoding='utf-8')
meta={'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':r.returncode}
try:
 d=json.loads(r.stdout); meta.update({k:d.get(k) for k in ['session_id','is_error','modelUsage']})
 result=d.get('result',''); (w/(name+'-response.txt')).write_text(result,encoding='utf-8')
 try:
  clean=result.strip()
  if clean.startswith('```'): clean=clean.split('\n',1)[1].rsplit('```',1)[0]
  (w/(name+'.json')).write_text(json.dumps(json.loads(clean),ensure_ascii=False,indent=2),encoding='utf-8')
 except Exception as e: meta['parse_error']=str(e)
except Exception as e: meta['error']=str(e)
(w/(name+'-meta.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(meta,ensure_ascii=True))
