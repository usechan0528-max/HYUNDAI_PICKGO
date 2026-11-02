// Invented coordinates around (0,0); no personal or measured vehicle locations.
const origin={latitude:0,longitude:0},shared={latitude:0,longitude:.001};
const work={latitude:.001,longitude:.001},shop={latitude:-.001,longitude:.001};
export const history=[
 {id:'work',profile:'owner',endedAtMs:10,points:[origin,shared,work],confirmedPurpose:'commute',departureSlot:'morning'},
 {id:'shop',profile:'owner',endedAtMs:20,points:[origin,shared,shop],confirmedPurpose:'errand',departureSlot:'afternoon'}
];
export function observationInput({scene,profile,consent,now}) {
 const points=scene==='unknown'?[{latitude:.01,longitude:.01}]:
 [origin,shared,...(scene==='work'||scene==='jitter'?[work]:scene==='shop'?[shop]:[])];
 const observations=points.map((p,i)=>({...p,
   latitude:p.latitude+(scene==='jitter'?[.00008,-.00006,.0001][i]:0),
   longitude:p.longitude+(scene==='jitter'?[-.00005,.00009,-.00004][i]:0),
   observedAtMs:now-(points.length-i)*1000-(scene==='stale'?31_000:0)}));
 return {source:'synthetic',profile:profile==='guest'?null:profile,consent,permission:true,
   startedAtMs:100,nowMs:now,observations};
}
