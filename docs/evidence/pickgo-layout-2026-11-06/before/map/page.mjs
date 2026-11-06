const $=id=>document.getElementById(id),L=window.L;
let map,selected,selectionGeneration=0,marker,session,state,busy=false,data,tilesReady=false;
let currentMarker,proposalMarker;const candidateMarkers=[];
try{session=JSON.parse(sessionStorage.getItem('pickupSession'));}catch{}
const question = session?.role === 'rider' ? '어디서 탈까요?' : '어디서 태울까요?';
$('mapQuestion').textContent = question;
$('selectionTitle').textContent = question;
const latlng=p=>[p[1],p[0]];
async function api(path,body,auth=false){const r=await fetch(path,{method:body?'POST':'GET',cache:'no-store',signal:AbortSignal.timeout(8000),headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth&&session?{Authorization:`Bearer ${session.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const out=await r.json();if(!r.ok)throw Error(out.error||'요청 실패');return out;}
function updateAction(){
  $('confirm').textContent=session?'장소 제안':'여기서 픽업';
  $('confirm').disabled=busy||!tilesReady||!data?.available||!selected?.selectable||!navigator.onLine||document.hidden||!!session&&(!state||state.status!=='active'||!state.joined||state.stage==='boarded'||!!state.proposal);
  $('roomState').textContent=!session?'선택한 장소는 초대한 상대에게 공유됩니다.':!state?'현재 약속을 확인하지 못했습니다. 약속판에서 다시 확인해 주세요.':!state.joined?'상대가 초대에 참여한 뒤 위치를 제안할 수 있습니다.':state.proposal?'기존 장소 제안을 처리한 뒤 다시 선택하세요.':'상대 수락 전까지 기존 픽업 지점을 유지합니다.';
}
function tooltip(text){const node=document.createElement('span');node.textContent=text;return node;}
function icon(label,cls=''){const el=document.createElement('span');el.className=`pin-content ${cls}`;el.textContent=label;return L.divIcon({className:'map-pin',html:el,iconSize:[30,30],iconAnchor:[15,15]});}
async function choose(point){
  if(busy)return;const gen=++selectionGeneration;selected=null;updateAction();$('selectionTitle').textContent='장소 확인 중';$('selectionText').textContent='금지·접근 제한 영역을 검사하고 있습니다.';
  if(marker)marker.remove();marker=L.marker(latlng(point),{icon:icon('·','pin-selected')}).addTo(map);
  try{const result=await api('/api/map/check',{point});if(gen!==selectionGeneration)return;selected=result;marker.setIcon(icon(result.selectable?'✓':'×',result.selectable?'pin-selected':'pin-blocked'));
    $('selectionTitle').textContent=result.selectable?'선택한 장소':'선택할 수 없는 장소';$('selectionTitle').closest('section').classList.toggle('bad',!result.selectable);
    $('selectionText').textContent=result.selectable?`${result.road} · ${result.advisories.join(' ')}`:result.reasons.join(' · ');
    $('coordinates').textContent='';
  }catch(e){if(gen!==selectionGeneration)return;$('selectionTitle').textContent='확인하지 못했습니다';$('selectionText').textContent=e.message;selected=null;}
  updateAction();
  // On stacked layouts, reveal the result and its action after a deliberate pin choice.
  if(matchMedia('(max-width:899px)').matches){
    const title=$('selectionTitle');title.setAttribute('tabindex','-1');
    title.focus({preventScroll:true});title.closest('section').scrollIntoView({block:'nearest',behavior:'instant'});
  }
}
async function refreshRoom(){
  if(data&&Date.now()>=Date.parse(data.retrievedAt)+7*86400000){data.available=false;selected=null;$('candidates').textContent='지도 판정 데이터 갱신 필요';for(const marker of candidateMarkers)marker.remove();}
  if(session&&!busy){try{state=await api(`/api/rooms/${session.id}`,null,true);}catch{state=null;}}
  if(map){
    currentMarker?.remove();proposalMarker?.remove();currentMarker=proposalMarker=null;
    if(state?.mapPoint)currentMarker=L.marker(latlng(state.mapPoint),{icon:icon('약','pin-selected')}).addTo(map).bindTooltip('현재 합의된 픽업 지점');
    if(state?.proposal?.mapPoint)proposalMarker=L.marker(latlng(state.proposal.mapPoint),{icon:icon('제','pin-proposal')}).addTo(map).bindTooltip('미확정 변경 제안 · 약속판에서 수락/거절');
  }
  updateAction();
}
async function start(){
  try{
    const place=new URLSearchParams(location.search).get('place');
    data=await api(place?`/api/map?place=${encodeURIComponent(place)}`:'/api/map');
    $('mapIntro').textContent=`${data.anchor.name} 주변`;
    $('mapAreaTitle').textContent=`${data.anchor.name} 주변`;
    $('map').setAttribute('aria-label',`${data.anchor.name} 주변 지도`);
    map=L.map('map',{minZoom:15,maxZoom:19,maxBounds:[[data.bounds[1],data.bounds[0]],[data.bounds[3],data.bounds[2]]],maxBoundsViscosity:1}).setView(latlng(data.anchor.coordinates),17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://www.openstreetmap.org/fixthemap">지도 오류 제보</a>'}).on('load',function(){tilesReady=[...this.getContainer().querySelectorAll('img.leaflet-tile')].every(i=>i.complete&&i.naturalWidth>0);if(tilesReady)$('error').textContent='';updateAction();}).on('tileerror',()=>{tilesReady=false;$('error').textContent='배경 지도 연결 실패 · 도형만으로 위치를 판단하지 말고 연결 후 다시 확인하세요.';selected=null;updateAction();}).addTo(map);
    const layer=L.layerGroup().addTo(map),lines=[];
    for(const z of data.zones){
      if(z.type==='LineString'){
        const line=L.polyline(z.coordinates.map(latlng),{color:'#ba5147',opacity:.28,interactive:false,lineCap:'round',lineJoin:'round'}).addTo(layer);lines.push([line,z.radius]);
      }else L.geoJSON(z.displayGeometry,{style:{color:'#b94f46',weight:1,fillColor:'#c56354',fillOpacity:z.reason==='건물 내부'?.16:.28},interactive:false}).addTo(layer);
    }
    const widths=()=>{const mpp=40075016.686*Math.cos(map.getCenter().lat*Math.PI/180)/Math.pow(2,map.getZoom()+8);for(const [l,r] of lines)l.setStyle({weight:Math.max(1,2*r/mpp)});};map.on('zoomend',widths);widths();
    $('zones').onchange=()=>{$('zones').checked?layer.addTo(map):layer.remove();};
    L.marker(latlng(data.anchor.coordinates),{title:data.anchor.name,alt:data.anchor.name,icon:L.divIcon({className:'map-pin',html:'<span class="pin-anchor"></span>',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(map).bindTooltip(tooltip(data.anchor.name),{direction:'top'}).on('click',()=>choose(data.anchor.coordinates));
    $('candidates').replaceChildren();
    data.recommendations.forEach((c,i)=>{
      const direction=c.name;
      candidateMarkers.push(L.marker(latlng(c.point),{icon:icon(i+1)}).addTo(map).bindTooltip(tooltip(`${i+1}. ${direction}`)).on('click',()=>choose(c.point)));
      const b=document.createElement('button');b.className='candidate';const number=document.createElement('span');number.className='number';number.textContent=i+1;
      const text=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=direction;small.textContent=`직선 ${c.distanceM}m · 도로폭 ${c.roadWidthM}m 표기`;text.append(strong,small);b.append(number,text);b.onclick=()=>{map.panTo(latlng(c.point));void choose(c.point);};$('candidates').append(b);
    });
    if(!data.recommendations.length)$('candidates').textContent=data.available?'조건에 맞는 추천 장소가 없습니다.':'지도 판정 데이터가 만료되었습니다. 갱신이 필요합니다.';
    $('dataInfo').textContent=`지도 데이터 수집: ${new Date(data.retrievedAt).toLocaleString('ko-KR')} · 양재사옥 주변 한정 · OpenStreetMap contributors`;
    const overview=()=>map.fitBounds([latlng(data.anchor.coordinates),...data.recommendations.map(c=>latlng(c.point))],{padding:[50,50],maxZoom:17});overview();$('home').onclick=overview;
    map.on('click',e=>choose([e.latlng.lng,e.latlng.lat]));await refreshRoom();
  }catch(e){$('error').textContent=`지도를 준비하지 못했습니다. ${e.message}`;$('candidates').textContent='새로고침하여 다시 연결해 주세요.';}
}
$('confirm').onclick=async()=>{
  if($('confirm').disabled)return;busy=true;updateAction();
  try{
    if(session){state=await api(`/api/rooms/${session.id}`,null,true);await api(`/api/rooms/${session.id}/actions`,{type:'proposePoint',point:selected.point,version:state.version,view:state.view,requestId:crypto.randomUUID()},true);}
    else{sessionStorage.setItem('pickupStorageProbe','1');sessionStorage.removeItem('pickupStorageProbe');const next=await api('/api/rooms',{point:selected.point});session=next;sessionStorage.setItem('pickupSession',JSON.stringify(next));}
    location.assign('/');
  }catch(e){$('selectionText').textContent=e.message;busy=false;await refreshRoom();updateAction();}
};
for(const event of ['offline','pagehide'])addEventListener(event,()=>{selectionGeneration++;selected=null;updateAction();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){selectionGeneration++;selected=null;updateAction();}else void refreshRoom();});
setInterval(refreshRoom,4000);void start();updateAction();
