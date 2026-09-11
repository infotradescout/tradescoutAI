import type { CabinetPlannerModule, CabinetPresentation } from "./cabinetPlannerModel";
export type CabinetCaseworkPart = {
  role: "carcass" | "door" | "drawer" | "rail" | "handle" | "toe-kick" | "shelf" | "glass" | "panel";
  centerIn: [number, number, number]; sizeIn: [number, number, number];
};
/** Render-only details stay inside the measured envelope. These are not shop drawings. */
export function buildCabinetCaseworkParts(module: CabinetPlannerModule, presentation?: CabinetPresentation): CabinetCaseworkPart[] {
  if (module.kind === "appliance") return [];
  const w = module.widthIn, h = module.heightIn, d = module.depthIn;
  if (![w,h,d].every(value => Number.isFinite(value) && value > 0)) return [];
  if (module.kind === "filler" || module.kind === "end-panel") {
    return [{ role: "panel", centerIn: [0, h / 2, 0], sizeIn: [w, h, d] }];
  }
  const parts: CabinetCaseworkPart[] = [];
  const t = Math.min(.7, w / 8, h / 12, d / 8);
  const toe = module.kind === "wall-cabinet" ? 0 : Math.min(4, h / 6);
  const faceZ = d / 2 - 2 * t;
  const gap = Math.min(.125, w / 30, h / 30);
  const add = (role: CabinetCaseworkPart["role"], sizeIn: [number,number,number], centerIn: [number,number,number]) => {
    if (sizeIn.every(value => value > 0 && Number.isFinite(value)) && centerIn.every(Number.isFinite)) parts.push({ role, sizeIn, centerIn });
  };
  add("carcass", [w, h - toe, t], [0, toe + (h-toe)/2, -d/2+t/2]);
  for (const side of [-1,1]) add("carcass", [t,h-toe,d-3*t], [side*(w/2-t/2),toe+(h-toe)/2,-1.5*t]);
  for (const y of [toe+t/2,h-t/2]) add("carcass", [w-2*t,t,d-3*t], [0,y,-1.5*t]);
  if (toe) add("toe-kick", [w-2*t,toe,Math.min(t,d/8)], [0,toe/2,Math.max(-d/2+t,d/2-Math.min(3,d/3))]);
  const mode = presentation?.fronts[module.id] ?? "doors";
  if (mode === "open") {
    for (const fraction of [1/3,2/3]) add("shelf", [w-2*t,t,d-3*t], [0,toe+(h-toe)*fraction,-1.5*t]);
    return parts;
  }
  const handle = (x:number, y:number, maxWidth:number, maxHeight:number, horizontal:boolean) => {
    if (!presentation?.hardware || presentation.hardware === "None") return;
    const length = Math.min(5, (horizontal ? maxWidth : maxHeight) * .45);
    const thickness = Math.min(.3,t/2);
    add("handle", horizontal ? [length,thickness,thickness] : [thickness,length,thickness], [x,y,d/2-t/3]);
    for (const sign of [-1,1]) add("handle", [thickness,thickness,t], [x+(horizontal?sign*length*.4:0),y+(horizontal?0:sign*length*.4),d/2-t]);
  };
  const face = (role: "door" | "drawer", x:number, y:number, width:number, height:number) => {
    const rail = Math.min(2,width/5,height/5);
    const framed = presentation?.style && presentation.style !== "Slab";
    add(presentation?.style === "Glass accent" && role === "door" ? "glass" : role, [width,height,t/2], [x,y,faceZ]);
    if (framed) {
      for (const sign of [-1,1]) {
        add("rail", [rail,height,t/2], [x+sign*(width-rail)/2,y,faceZ+t/2]);
        add("rail", [width-2*rail,rail,t/2], [x,y+sign*(height-rail)/2,faceZ+t/2]);
      }
      if (presentation?.style === "Raised panel") add(role, [width-2.6*rail,height-2.6*rail,t/3], [x,y,faceZ+t/2]);
    }
    handle(role === "drawer" ? x : x+(x<=0?1:-1)*Math.max(0,width/2-rail), role === "drawer" ? y : y+Math.min(height*.25,8), width,height,role === "drawer");
  };
  if (mode === "drawers") {
    const count = module.kind === "tall-cabinet" ? 5 : 3;
    const height = (h-toe)/count;
    for (let index=0;index<count;index++) face("drawer",0,toe+height*(index+.5),w-2*gap,height-2*gap);
  } else {
    const apron = mode === "sink" ? Math.min(7,(h-toe)/3) : 0;
    if (apron) add("drawer",[w-2*gap,apron-2*gap,t/2],[0,h-apron/2,faceZ]);
    const count = w > 23 ? 2 : 1;
    const width = w/count;
    for (let index=0;index<count;index++) face("door",-w/2+width*(index+.5),toe+(h-toe-apron)/2,width-2*gap,h-toe-apron-2*gap);
  }
  return parts;
}
export function cabinetFrontRotation(surface: CabinetPlannerModule["surface"]): number {
  return surface === "south" ? Math.PI : surface === "east" ? -Math.PI/2 : surface === "west" ? Math.PI/2 : 0;
}
