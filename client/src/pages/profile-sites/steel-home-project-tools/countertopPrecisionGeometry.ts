import type { CountertopPlannerDesignInput } from "./countertopPlannerModel";
export type ReviewPolygon = { id:string; points:Array<[number,number]> };
export type CountertopReviewGeometry = { polygons:ReviewPolygon[]; viewBox:[number,number,number,number]; unresolved:string[] };
/** SVG user units are inches on BOTH axes; no independent run/depth clamping. */
export function buildCountertopReviewGeometry(design: CountertopPlannerDesignInput): CountertopReviewGeometry {
  const a=design.wallAIn,b=design.wallBIn,c=design.wallCIn,d=design.wallDepthIn;
  const polygons:ReviewPolygon[]=[],unresolved:string[]=[];
  const valid=[a,d,...(design.layout!=="straight"?[b]:[]),...(design.layout==="u-shape"?[c]:[])].every(v=>Number.isFinite(v)&&v>0);
  if(!valid)unresolved.push("Enter positive run and depth measurements.");
  else if((design.layout!=="straight"&&b<d)||(design.layout==="u-shape"&&(a<2*d||c<d))||(design.layout==="l-shape"&&a<d))unresolved.push("The return layout cannot fit the entered countertop depth.");
  else polygons.push({id:"wall-runs",points:design.layout==="straight"?[[0,0],[a,0],[a,d],[0,d]]:design.layout==="l-shape"?[[0,0],[a,0],[a,d],[d,d],[d,b],[0,b]]:[[0,0],[a,0],[a,c],[a-d,c],[a-d,d],[d,d],[d,b],[0,b]]});
  if(design.island){
    const x=design.islandLeftOffsetIn,y=design.islandBackOffsetIn,w=design.islandLengthIn,h=design.islandWidthIn;
    if(x===null||x===undefined||y===null||y===undefined||![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)unresolved.push("Enter the island dimensions and measured position before placing it on this drawing.");
    else polygons.push({id:"island",points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]});
  }
  const points=polygons.flatMap(p=>p.points);
  if(design.roomWidthIn&&design.roomDepthIn)points.push([0,0],[design.roomWidthIn,design.roomDepthIn]);
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(0,...xs),minY=Math.min(0,...ys),maxX=Math.max(24,...xs),maxY=Math.max(24,...ys);
  const padding=Math.max(12,(Math.max(maxX-minX,maxY-minY))*.09);
  return {polygons,unresolved,viewBox:[minX-padding,minY-padding,maxX-minX+2*padding,maxY-minY+2*padding]};
}
