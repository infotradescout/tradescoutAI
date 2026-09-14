import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CABINET_STUDIO_FINISHES, getCabinetModuleBounds, reconcileCabinetPlannerExtension, type CabinetPlannerExtensionV1 } from "./cabinetPlannerModel";
import { buildCabinetCaseworkParts, cabinetFrontRotation } from "./cabinetCasework";

type Props = { planner: CabinetPlannerExtensionV1; onSelectModule: (id:string) => void };
export type CabinetPreviewBox = { id:string; category:"module"|"shell-item"; kind:string; centerIn:[number,number,number]; sizeIn:[number,number,number] };
export function buildCabinetPreviewSnapshot(input: CabinetPlannerExtensionV1): CabinetPreviewBox[] {
  const planner = reconcileCabinetPlannerExtension(input);
  const width = planner.shell.widthIn, depth = planner.shell.depthIn;
  if (width === null || depth === null) return [];
  const result: CabinetPreviewBox[] = [];
  for (const module of planner.modules) {
    const b = getCabinetModuleBounds(planner,module); if (!b) continue;
    result.push({id:module.id,category:"module",kind:module.kind,centerIn:[(b.x1+b.x2)/2,(b.y1+b.y2)/2,(b.z1+b.z2)/2],sizeIn:[b.x2-b.x1,b.y2-b.y1,b.z2-b.z1]});
  }
  for (const item of planner.shellItems) {
    const y=item.elevationIn+item.heightIn/2, along=item.offsetIn+item.widthIn/2, thickness=Math.max(1,item.depthIn);
    const horizontal=item.wall === "north" || item.wall === "south";
    const centerIn: [number,number,number] = item.wall === "north" ? [along,y,0] : item.wall === "south" ? [width-along,y,depth] : item.wall === "east" ? [width,y,along] : [0,y,depth-along];
    result.push({id:item.id,category:"shell-item",kind:item.kind,centerIn,sizeIn:horizontal?[item.widthIn,item.heightIn,thickness]:[thickness,item.heightIn,item.widthIn]});
  }
  return result;
}
function dispose(group:THREE.Object3D) {
  group.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material)?object.material:[object.material]) material.dispose();
    }
  });
  group.clear();
}
function box(parent:THREE.Object3D,size:number[],center:number[],color:string,options:{opacity?:number;metalness?:number;id?:string}={}) {
  const material=new THREE.MeshStandardMaterial({color,roughness:options.metalness?.8:.68,metalness:options.metalness??.02,transparent:options.opacity!==undefined,opacity:options.opacity??1,depthWrite:options.opacity===undefined});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(size[0],size[1],size[2]),material);
  mesh.position.set(center[0],center[1],center[2]); mesh.userData.moduleId=options.id;
  parent.add(mesh); return mesh;
}
function frame(parent:THREE.Object3D,size:number[],center:number[],color:string,id?:string) {
  const source=new THREE.BoxGeometry(size[0],size[1],size[2]);
  const line=new THREE.LineSegments(new THREE.EdgesGeometry(source),new THREE.LineBasicMaterial({color})); source.dispose();
  line.position.set(center[0],center[1],center[2]); line.userData.moduleId=id; parent.add(line);
}
function drawRoom(group:THREE.Group,planner:CabinetPlannerExtensionV1) {
  const {widthIn:w,depthIn:d,heightIn:h}=planner.shell;
  if(w===null||d===null||h===null)return;
  const width=w/12,depth=d/12,height=h/12;
  box(group,[width,.08,depth],[0,-.04,0],"#c4b6a0");
  box(group,[width,height,.06],[0,height/2,-depth/2],"#e9e7e0",{opacity:.48});
  box(group,[.06,height,depth],[-width/2,height/2,0],"#e1dfd6",{opacity:.24});
  // The front and right room boundaries remain open for inspection, not opaque walls.
  frame(group,[width,height,depth],[0,height/2,0],"#b7beb4");
  const finish=CABINET_STUDIO_FINISHES.find(f=>f.value===planner.presentation?.finish)?.color??"#d5d0c5";
  const hardware=planner.presentation?.hardware;
  const hardwareColor=hardware==="Brushed brass"?"#b59a5c":hardware==="Matte black"?"#24282a":hardware==="Polished chrome"?"#e0e4e5":"#9da6a8";
  for(const module of planner.modules){
    const b=getCabinetModuleBounds(planner,module);if(!b)continue;
    const center=[(b.x1+b.x2)/24-width/2,(b.y1+b.y2)/24,(b.z1+b.z2)/24-depth/2];
    const size=[(b.x2-b.x1)/12,(b.y2-b.y1)/12,(b.z2-b.z1)/12];
    if(module.kind==="appliance") {frame(group,size,center,"#697e85",module.id);continue;}
    const cabinet=new THREE.Group();cabinet.position.set(center[0],module.elevationIn/12,center[2]);cabinet.rotation.y=cabinetFrontRotation(module.surface);group.add(cabinet);
    for(const part of buildCabinetCaseworkParts(module,planner.presentation)){
      box(cabinet,part.sizeIn.map(v=>v/12),part.centerIn.map(v=>v/12),part.role==="handle"?hardwareColor:part.role==="toe-kick"?"#514c43":part.role==="glass"?"#b5d0d1":finish,{id:module.id,...(part.role==="handle"?{metalness:.75}:{}),...(part.role==="glass"?{opacity:.3}:{})});
    }
    if(module.id===planner.selectedModuleId)frame(group,size,center,"#b75732");
  }
  for(const item of buildCabinetPreviewSnapshot(planner).filter(item=>item.category==="shell-item")){
    const center=[item.centerIn[0]/12-width/2,item.centerIn[1]/12,item.centerIn[2]/12-depth/2];
    const size=item.sizeIn.map(v=>v/12);
    if(item.kind==="door"||item.kind==="window"){frame(group,size,center,item.kind==="window"?"#6d9ba1":"#60766b");if(item.kind==="window")box(group,size,center,"#99c6cb",{opacity:.18});}
    else box(group,size,center,item.kind==="obstacle"?"#a36152":"#497f91",{opacity:.65});
  }
}
type Runtime={renderer:THREE.WebGLRenderer;camera:THREE.PerspectiveCamera;controls:OrbitControls;content:THREE.Group;render:()=>void;fit:()=>void;framed:boolean};
export default function CabinetThreePreview({planner,onSelectModule}:Props){
  const canvasRef=useRef<HTMLCanvasElement>(null),runtime=useRef<Runtime|null>(null);
  const selectRef=useRef(onSelectModule);selectRef.current=onSelectModule;
  const canonical=useMemo(()=>reconcileCabinetPlannerExtension(planner),[planner]);
  const latest=useRef(canonical);latest.current=canonical;
  const [error,setError]=useState<string|null>(null),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    let renderer:THREE.WebGLRenderer|undefined,controls:OrbitControls|undefined,content:THREE.Group|undefined,observer:ResizeObserver|undefined;
    const cleanup:Array<()=>void>=[];
    try{
      renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
      const scene=new THREE.Scene();scene.background=new THREE.Color("#efede6");
      const camera=new THREE.PerspectiveCamera(42,1,.05,500);content=new THREE.Group();scene.add(content);
      scene.add(new THREE.HemisphereLight("#fffaf1","#6a756c",2.5));const light=new THREE.DirectionalLight("#fff1d7",3);light.position.set(12,18,10);scene.add(light);
      controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.screenSpacePanning=false;canvas.style.touchAction="pan-y";
      const render=()=>renderer?.render(scene,camera);
      const fit=()=>{
        const bounds=new THREE.Box3().setFromObject(content!);if(bounds.isEmpty())return;
        const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
        const radius=Math.max(size.length()/2,1);const halfFov=THREE.MathUtils.degToRad(camera.fov/2);
        const limitingHalf=Math.min(halfFov,Math.atan(Math.tan(halfFov)*camera.aspect));
        const distance=radius/Math.sin(limitingHalf)*1.1;
        controls!.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(1,.75,1.2).normalize().multiplyScalar(distance));
        camera.near=Math.max(.02,radius/300);camera.far=Math.max(200,distance*8);camera.updateProjectionMatrix();controls!.minDistance=Math.max(.5,radius*.15);controls!.maxDistance=distance*4;controls!.update();render();
      };
      const resize=()=>{const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);renderer!.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();};
      runtime.current={renderer,camera,controls,content,render,fit,framed:false};
      drawRoom(content,latest.current);resize();if(latest.current.shell.widthIn!==null){fit();runtime.current.framed=true;}
      controls.addEventListener("change",render);cleanup.push(()=>controls?.removeEventListener("change",render));
      if(typeof ResizeObserver!=="undefined"){observer=new ResizeObserver(resize);observer.observe(canvas);}else{window.addEventListener("resize",resize);cleanup.push(()=>window.removeEventListener("resize",resize));}
      let down:[number,number]|null=null;
      const pointerDown=(event:PointerEvent)=>{down=[event.clientX,event.clientY];};
      const pointerCancel=()=>{down=null;};
      const pointerUp=(event:PointerEvent)=>{
        const start=down;down=null;if(!start||Math.hypot(event.clientX-start[0],event.clientY-start[1])>5)return;
        const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
        const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
        const hit=ray.intersectObjects(content!.children,true).find(hit=>typeof hit.object.userData.moduleId==="string");
        if(hit)selectRef.current(hit.object.userData.moduleId);
      };
      const lost=(event:Event)=>{event.preventDefault();setError("The graphics context was interrupted. Use the measured plan and elevations instead.");};
      canvas.addEventListener("pointerdown",pointerDown);canvas.addEventListener("pointerup",pointerUp);canvas.addEventListener("pointercancel",pointerCancel);canvas.addEventListener("webglcontextlost",lost);
      cleanup.push(()=>{canvas.removeEventListener("pointerdown",pointerDown);canvas.removeEventListener("pointerup",pointerUp);canvas.removeEventListener("pointercancel",pointerCancel);canvas.removeEventListener("webglcontextlost",lost);});
      setError(null);
    }catch{setError("This browser could not start the orbitable room. Use the measured plan and elevations instead.");}
    return()=>{cleanup.forEach(fn=>fn());observer?.disconnect();controls?.dispose();if(content)dispose(content);renderer?.dispose();runtime.current=null;canvas.style.touchAction="";};
  },[attempt]);
  useEffect(()=>{const current=runtime.current;if(!current)return;dispose(current.content);drawRoom(current.content,canonical);if(!current.framed&&canonical.shell.widthIn!==null){current.fit();current.framed=true;}current.render();},[canonical,attempt]);
  const move=useCallback((rotation:number,scale=1)=>{const r=runtime.current;if(!r)return;const offset=r.camera.position.clone().sub(r.controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),rotation).multiplyScalar(scale);r.camera.position.copy(r.controls.target).add(offset);r.controls.update();r.render();},[]);
  const button="min-h-11 rounded-lg border border-white/30 bg-[#18312f] px-3 py-2 text-xs font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";
  return <div className="relative h-full min-h-[24rem] overflow-hidden bg-[#efede6]" data-testid="steel-home-cabinet-three-preview">
    <canvas key={attempt} ref={canvasRef} className="block h-full min-h-[24rem] w-full" aria-label="Orbitable cabinet room. Drag to orbit, zoom, or tap a cabinet to select it." aria-hidden={error?true:undefined}/>
    {error?<div className="absolute inset-0 grid place-items-center bg-[#17201f] p-6 text-center text-white" role="alert"><div><p className="font-bold">3D room unavailable</p><p className="my-3 text-sm">{error}</p><button type="button" className={button} onClick={()=>setAttempt(v=>v+1)}>Retry 3D</button></div></div>:<>
      <div className="pointer-events-none absolute left-3 top-3 max-w-[75%] rounded-lg bg-white/95 px-3 py-2 text-xs text-[#18312f]"><strong>Cabinet appearance preview</strong><p>Measured placement · illustrative construction details</p></div>
      <div className="absolute inset-x-3 bottom-3 flex flex-wrap justify-center gap-2" aria-label="Cabinet camera controls"><button type="button" className={button} onClick={()=>move(-Math.PI/8)}>Orbit left</button><button type="button" className={button} onClick={()=>move(Math.PI/8)}>Orbit right</button><button type="button" className={button} onClick={()=>move(0,.8)}>Zoom in</button><button type="button" className={button} onClick={()=>move(0,1.25)}>Zoom out</button><button type="button" className={button} onClick={()=>runtime.current?.fit()}>Reset view</button></div>
    </>}
  </div>;
}
