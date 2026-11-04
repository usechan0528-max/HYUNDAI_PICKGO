"""Normalize a small, explicitly downloaded OSM API JSON export. No runtime network calls.
Usage: python map/import_osm.py input.json output.json
ODbL attribution and source URL travel with the output; contributor identities are omitted.
"""
import sys,json,datetime
from pathlib import Path

def point_in_ring(p,ring):
    x,y=p; inside=False
    for a,b in zip(ring,ring[1:]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
    return inside

def normalize(raw):
    es=raw['elements']; nodes={e['id']:e for e in es if e['type']=='node'};ways={e['id']:e for e in es if e['type']=='way'}
    def coords(ids):
        if any(n not in nodes for n in ids):raise ValueError('Incomplete geometry; export a complete area')
        return [[nodes[n]['lon'],nodes[n]['lat']] for n in ids]
    features=[]
    for e in es:
        t=e.get('tags',{})
        if e['type']=='node' and t:features.append({'id':'node/'+str(e['id']),'type':'Point','coordinates':[e['lon'],e['lat']],'tags':t})
        elif e['type']=='way' and t:
            xy=coords(e['nodes']);closed=e['nodes'][0]==e['nodes'][-1]
            area=closed and (t.get('building') or t.get('landuse') or t.get('natural') or t.get('leisure') or t.get('area')=='yes' or t.get('amenity') in ['parking','school','kindergarten'])
            features.append({'id':'way/'+str(e['id']),'type':'Polygon' if area else 'LineString','coordinates':xy,'nodeIds':e['nodes'],'tags':t})
    # Restriction-relevant multipolygons must not silently disappear. Assemble outer/inner ways.
    for e in es:
        t=e.get('tags',{})
        if e['type']!='relation' or t.get('type')!='multipolygon' or not(t.get('building') or t.get('natural')=='water'):continue
        rings={}
        for role in ['outer','inner']:
            segments=[]
            for m in e['members']:
                if m['type']=='way' and m.get('role','outer')==role:
                    if m['ref'] not in ways:raise ValueError('Incomplete restriction multipolygon')
                    segments.append(list(ways[m['ref']]['nodes']))
            assembled=[]
            while segments:
                line=segments.pop()
                while line[0]!=line[-1]:
                    for i,part in enumerate(segments):
                        if part[0]==line[-1]:line+=part[1:];segments.pop(i);break
                        if part[-1]==line[-1]:line+=list(reversed(part))[1:];segments.pop(i);break
                    else:raise ValueError('Unclosed restriction multipolygon')
                assembled.append(coords(line))
            rings[role]=assembled
        if not rings['outer']:raise ValueError('Missing outer restriction polygon')
        for i,ring in enumerate(rings['outer']):features.append({'id':f"relation/{e['id']}:{i}",'type':'Polygon','coordinates':ring,'holes':[h for h in rings['inner'] if point_in_ring(h[0],ring)],'tags':t})
    ring=next(f for f in features if f['id']=='way/144376088')['coordinates'][:-1]
    center=[sum(c[i] for c in ring)/len(ring) for i in [0,1]]
    return {'version':1,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'OpenStreetMap contributors','sourceUrl':'https://api.openstreetmap.org/api/0.6/map.json?bbox=127.032,37.455,127.050,37.471','additionalSourceUrls':['https://api.openstreetmap.org/api/0.6/relation/6942680/full.json'],'license':'ODbL-1.0','licenseUrl':'https://opendatacommons.org/licenses/odbl/1-0/','bounds':[127.032,37.455,127.050,37.471],'anchor':{'name':'현대자동차 양재사옥','coordinates':center,'sourceId':'way/144376088'},'coverage':'partial','features':features}

if __name__=='__main__':
    source,target=map(Path,sys.argv[1:]);data=normalize(json.loads(source.read_text(encoding='utf-8')))
    # Collection time is input file download time, not normalization/refresh time.
    data['retrievedAt']=datetime.datetime.fromtimestamp(source.stat().st_mtime,datetime.timezone.utc).isoformat()
    target.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f"normalized {len(data['features'])} features")
