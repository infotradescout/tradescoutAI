import { describe,expect,it } from "vitest";
import { createBlankCabinetPlannerExtension,createCabinetPlannerModule,reconcileCabinetPlannerExtension,duplicateCabinetModule,buildCabinetPlannerRequestBrief } from "./cabinetPlannerModel";
import { buildCabinetCaseworkParts,cabinetFrontRotation } from "./cabinetCasework";
import { createDesignerHistory,stepDesignerHistory } from "./useDesignerHistory";
import { createEmptySteelHomeProjectDraft } from "./projectModel";
import { buildCountertopReviewGeometry } from "./countertopPrecisionGeometry";

describe("Cabinet presentation stays on the measured saved draft",()=>{
 it("does not invent an appearance for legacy or blank plans",()=>{expect(reconcileCabinetPlannerExtension(createBlankCabinetPlannerExtension()).presentation).toBeUndefined();});
 it("round-trips selected appearance while dropping foreign and invalid front settings",()=>{
  const state=reconcileCabinetPlannerExtension({...createBlankCabinetPlannerExtension(),modules:[createCabinetPlannerModule("base-cabinet","a")],presentation:{style:"Shaker",finish:"sage",hardware:"Brushed brass",fronts:{a:"drawers",foreign:"doors"}}});
  expect(reconcileCabinetPlannerExtension(JSON.parse(JSON.stringify(state)))).toEqual(state);
  expect(Object.keys(state.presentation!.fronts)).toEqual(["a"]);expect(buildCabinetPlannerRequestBrief(state)).toContain("Shaker");
 });
 it("rejects arbitrary appearance strings without changing dimensions",()=>{
  const state=reconcileCabinetPlannerExtension({shell:{widthIn:144,depthIn:120,heightIn:96},presentation:{style:"unknown",finish:"red",hardware:"unknown",fronts:{}}});
  expect(state.presentation).toMatchObject({style:null,finish:null,hardware:null});expect(state.shell.widthIn).toBe(144);
 });
 it("duplicates the selected cabinet and its chosen fronts without claiming reviewed geometry",()=>{
  const state=reconcileCabinetPlannerExtension({starter:"kitchen",shell:{widthIn:144,depthIn:120,heightIn:96,measurementsReviewed:true},modules:[createCabinetPlannerModule("base-cabinet","a")],presentation:{style:"Slab",fronts:{a:"drawers"}}});
  const copy=duplicateCabinetModule(state,"a","b");expect(copy.modules[1].offsetIn).toBe(30);expect(copy.presentation!.fronts.b).toBe("drawers");expect(copy.shell.measurementsReviewed).toBe(false);expect(state.modules).toHaveLength(1);
 });
 it("does not add a duplicate with a colliding identity",()=>{const state=reconcileCabinetPlannerExtension({modules:[createCabinetPlannerModule("base-cabinet","a")]});expect(duplicateCabinetModule(state,"a","a").modules).toHaveLength(1);});
});
describe("Cabinet casework is geometry, not solid boxes",()=>{
 it("models doors, drawer fronts, rails and selected hardware",()=>{
  const module=createCabinetPlannerModule("base-cabinet","a");
  const p={style:"Shaker" as const,finish:"sage" as const,hardware:"Brushed brass" as const,fronts:{a:"drawers" as const}};
  const parts=buildCabinetCaseworkParts(module,p);expect(parts.filter(p=>p.role==="drawer")).toHaveLength(3);expect(parts.some(p=>p.role==="rail")).toBe(true);expect(parts.some(p=>p.role==="handle")).toBe(true);
  expect(buildCabinetCaseworkParts(module).some(p=>p.role==="handle")).toBe(false);
 });
 it("keeps every visual detail inside its measured envelope, including tiny modules",()=>{
  for(const dimensions of [[30,34.5,24],[.125,.125,.125],[240,240,120]])for(const style of ["Shaker","Slab","Raised panel","Glass accent"] as const){
    const module={...createCabinetPlannerModule("base-cabinet","a"),widthIn:dimensions[0],heightIn:dimensions[1],depthIn:dimensions[2]};
    for(const part of buildCabinetCaseworkParts(module,{style,finish:null,hardware:"Matte black",fronts:{a:"doors"}})){
      part.sizeIn.forEach(n=>expect(n).toBeGreaterThan(0));
      expect(Math.abs(part.centerIn[0])+part.sizeIn[0]/2).toBeLessThanOrEqual(module.widthIn/2+.0001);
      expect(part.centerIn[1]-part.sizeIn[1]/2).toBeGreaterThanOrEqual(-.0001);
      expect(part.centerIn[1]+part.sizeIn[1]/2).toBeLessThanOrEqual(module.heightIn+.0001);
      expect(Math.abs(part.centerIn[2])+part.sizeIn[2]/2).toBeLessThanOrEqual(module.depthIn/2+.0001);
    }
  }
 });
 it("orients fronts inward on all four walls",()=>{expect(cabinetFrontRotation("north")).toBe(0);expect(cabinetFrontRotation("south")).toBe(Math.PI);expect(cabinetFrontRotation("east")).toBe(-Math.PI/2);expect(cabinetFrontRotation("west")).toBe(Math.PI/2);});
 it("does not fabricate an appliance model for an appliance space",()=>{expect(buildCabinetCaseworkParts(createCabinetPlannerModule("appliance","a"))).toEqual([]);});
});
describe("Both designers preserve editable history",()=>{
 it("undoes and redoes a complete nested design without mutating the original",()=>{const first={modules:[{width:30}],notes:"Keep me"};let history=createDesignerHistory(first);history=stepDesignerHistory(history,{value:{modules:[{width:36}],notes:"Keep me"}});expect(stepDesignerHistory(history,"undo").present).toEqual(first);expect(stepDesignerHistory(stepDesignerHistory(history,"undo"),"redo").present.modules[0].width).toBe(36);expect(first.modules[0].width).toBe(30);});
 it("clears stale redo after a new edit and caps history",()=>{let h=createDesignerHistory(0);for(let n=1;n<=100;n++)h=stepDesignerHistory(h,{value:n});expect(h.past).toHaveLength(80);h=stepDesignerHistory(h,"undo");h=stepDesignerHistory(h,{value:101});expect(h.future).toEqual([]);});
});
describe("Countertop reviews use one true scale",()=>{
 it("preserves a long run without clamping the display geometry",()=>{const d={...createEmptySteelHomeProjectDraft().countertops,layout:"straight" as const,wallAIn:600,wallDepthIn:24,island:false};const g=buildCountertopReviewGeometry(d);expect(g.polygons[0].points).toEqual([[0,0],[600,0],[600,24],[0,24]]);});
 it("keeps L and U corner geometry at the entered dimensions",()=>{const d={...createEmptySteelHomeProjectDraft().countertops,layout:"u-shape" as const,wallAIn:144,wallBIn:96,wallCIn:120,wallDepthIn:24,island:false};expect(buildCountertopReviewGeometry(d).polygons[0].points).toEqual([[0,0],[144,0],[144,120],[120,120],[120,24],[24,24],[24,96],[0,96]]);});
 it("does not invent island placement",()=>{const d={...createEmptySteelHomeProjectDraft().countertops,island:true,islandLeftOffsetIn:null,islandBackOffsetIn:null};const g=buildCountertopReviewGeometry(d);expect(g.polygons.some(p=>p.id==="island")).toBe(false);expect(g.unresolved.length).toBeGreaterThan(0);});
 it("honors measured negative island offsets instead of visually recentering them",()=>{const d={...createEmptySteelHomeProjectDraft().countertops,island:true,islandLengthIn:60,islandWidthIn:36,islandLeftOffsetIn:-20,islandBackOffsetIn:80};const g=buildCountertopReviewGeometry(d);expect(g.polygons.find(p=>p.id==="island")!.points[0]).toEqual([-20,80]);expect(g.viewBox[0]).toBeLessThan(-20);});
});
