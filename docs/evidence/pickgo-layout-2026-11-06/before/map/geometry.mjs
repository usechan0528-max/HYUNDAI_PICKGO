// Local metre projection for the bounded Yangjae dataset (not a routing engine).
const LAT=111320, LON=111320*Math.cos(37.464*Math.PI/180);
export const distance=(a,b)=>Math.hypot((a[0]-b[0])*LON,(a[1]-b[1])*LAT);
export function nearest(p,line){
  let best={distance:Infinity,point:null};
  for(let i=1;i<line.length;i++){
    const a=line[i-1],b=line[i],dx=(b[0]-a[0])*LON,dy=(b[1]-a[1])*LAT;
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*LON*dx+(p[1]-a[1])*LAT*dy)/(dx*dx+dy*dy||1)));
    const point=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],d=distance(p,point);
    if(d<best.distance)best={distance:d,point};
  }return best;
}
export function inside(p,ring){
  if(nearest(p,ring).distance<0.05)return true;
  let hit=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }return hit;
}
export function offset(a,b,metres){
  const dx=(b[0]-a[0])*LON,dy=(b[1]-a[1])*LAT,d=Math.hypot(dx,dy)||1;
  return [(a[0]+b[0])/2-dy/d*metres/LON,(a[1]+b[1])/2+dx/d*metres/LAT];
}
export function circle(p,r){return Array.from({length:33},(_,i)=>[p[0]+Math.cos(i*Math.PI/16)*r/LON,p[1]+Math.sin(i*Math.PI/16)*r/LAT]);}
