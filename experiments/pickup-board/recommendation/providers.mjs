import { PLACES } from '../domain.mjs';
export const unavailableProvider = Object.freeze({ mode:'unavailable', async evaluate() { return null; } });
// Explicit opt-in synthetic graph; costs are graph-edge sums, never straight-line walking estimates.
export const syntheticProvider = Object.freeze({
  mode:'synthetic',
  selectionEvidence(name) { return PLACES.includes(name)?{vehicleAllowed:true,physicallyAccessible:true,positionType:'curb',closed:false,stopProhibited:false}:{}; },
  async evaluate({driver,rider,now,wall}) {
    const routeId=`demo:${driver.id}:${rider.id}`;
    const east=driver.longitude>127.001;
    const riderEast=rider.longitude>127.001;
    const driving=east?[240,30,90]:[30,210,90];
    const walking=riderEast?[240,40,120]:[30,240,120];
    return { mode:'synthetic', driver, rider,
      route:{id:routeId, driverFixId:driver.id, riderFixId:rider.id, mode:'synthetic',at:now,until:now+5000},
      candidates:PLACES.map((name,i)=>({id:`demo-${i}`,name,entranceId:`demo-entrance-${i}`,mode:'synthetic',
        evidence:{entranceId:`demo-entrance-${i}`,mode:'synthetic',source:'합성 도로변 제한 정보',reference:`fixture:pickup-zone-${i}`,checkedAt:wall,validFrom:wall-1000,validUntil:wall+3600000,vehicleAllowed:true,physicallyAccessible:true,positionType:'curb',closed:false,stopProhibited:false},
        vehicle:{routeId,entranceId:`demo-entrance-${i}`,reachable:true,legalApproach:true,source:'합성 방향 도로 그래프',approach:east?'동쪽 도로 → 지정 진입로':'서쪽 도로 → 지정 진입로',detourSeconds:driving[i],arrivalSeconds:driving[i]+60,uturns:i===(east?0:1)?1:0},
        walk:{routeId,entranceId:`demo-entrance-${i}`,reachable:true,pathVerified:true,source:'합성 보행 그래프',seconds:walking[i],meters:walking[i]*1.2}
      })) };
  }
});
