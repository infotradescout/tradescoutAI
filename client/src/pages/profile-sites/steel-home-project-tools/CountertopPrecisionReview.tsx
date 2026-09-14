import { useMemo } from "react";
import { getCatalogItemById } from "@/features/jw-stone/catalog";
import { calculateCountertopSquareFeet, getCountertopCutoutRunLabel } from "./projectModel";
import { getCountertopPlannerOpeningSchedule, getCountertopPlannerDiagnostics, resolveCountertopPlannerDesign, type CountertopPlannerDesignInput } from "./countertopPlannerModel";
import { buildCountertopReviewGeometry } from "./countertopPrecisionGeometry";

type Props={design:CountertopPlannerDesignInput};
export default function CountertopPrecisionReview({design:input}:Props){
  const design=useMemo(()=>resolveCountertopPlannerDesign(input),[input]);
  const geometry=buildCountertopReviewGeometry(design),schedule=getCountertopPlannerOpeningSchedule(design);
  const diagnostics=getCountertopPlannerDiagnostics(design);
  const font=Math.max(3,geometry.viewBox[2]/58);
  const stone=getCatalogItemById(design.stoneId);
  return <section className="kitchen-designer-precision" aria-label="Countertop scaled drawing and schedule">
    <header><h2>Scaled countertop review</h2><p>{stone?.publicLabel??"Material not selected"} · {calculateCountertopSquareFeet(design).toFixed(2)} sq ft approximate plan area</p><p>Dimensions are inches. Both axes use the same scale. This is a planning review, not a fabrication template.</p></header>
    {!design.measurementsReviewed&&<p role="status">Measurements have not been reviewed. Starter dimensions are not confirmed project measurements.</p>}
    {geometry.unresolved.map(message=><p role="status" key={message}>{message}</p>)}
    <svg data-testid="countertop-precision-drawing" role="img" aria-label="Countertop plan with one consistent dimensional scale" viewBox={geometry.viewBox.join(" ")} style={{width:"100%",height:"min(65vh,620px)",minHeight:280,background:"#fbf9f3"}}>
      {design.roomWidthIn&&design.roomDepthIn&&<rect x={0} y={0} width={design.roomWidthIn} height={design.roomDepthIn} fill="none" stroke="#a7b5ae" strokeDasharray="2 2" strokeWidth={.5}/>}
      {geometry.polygons.map(p=><polygon key={p.id} data-surface={p.id} points={p.points.map(point=>point.join(",")).join(" ")} fill="#e0d5c1" stroke="#18312f" strokeWidth={.65}/>)}
      {geometry.polygons.some(p=>p.id==="wall-runs")&&<>
        <line x1={0} y1={-font*2} x2={design.wallAIn} y2={-font*2} stroke="#53695d" strokeWidth={.35}/>
        <text x={design.wallAIn/2} y={-font*2.5} textAnchor="middle" fontSize={font} fill="#18312f">Main run {design.wallAIn}″</text>
        <text x={design.wallAIn/2} y={design.wallDepthIn/2} textAnchor="middle" fontSize={font} fill="#18312f">Depth {design.wallDepthIn}″</text>
        {design.layout!=="straight"&&<text transform={`translate(${-font*1.5},${design.wallBIn/2}) rotate(-90)`} textAnchor="middle" fontSize={font} fill="#18312f">Left return {design.wallBIn}″</text>}
        {design.layout==="u-shape"&&<text transform={`translate(${design.wallAIn+font*2},${design.wallCIn/2}) rotate(-90)`} textAnchor="middle" fontSize={font} fill="#18312f">Right return {design.wallCIn}″</text>}
      </>}
      {geometry.polygons.filter(p=>p.id==="island").map(p=><text key={p.id} x={(p.points[0][0]+p.points[2][0])/2} y={(p.points[0][1]+p.points[2][1])/2} textAnchor="middle" fontSize={font} fill="#18312f">Island {design.islandLengthIn}″ × {design.islandWidthIn}″</text>)}
      {schedule.map(item=>{
        if(!item.run||item.positionIn===null||!item.widthIn||item.representation==="coordination-point")return null;
        if(item.run==="island"&&!geometry.polygons.some(p=>p.id==="island"))return null;
        if(item.run==="left-return"&&design.layout==="straight"||item.run==="right-return"&&design.layout!=="u-shape")return null;
        const depth=item.run==="island"?design.islandWidthIn:design.wallDepthIn;
        const holeDepth=item.placementKind==="full-depth-gap"?depth:item.depthIn;
        if(!holeDepth||item.requiresFrontPosition&&item.frontPositionIn===null)return null;
        const front=item.placementKind==="full-depth-gap"?depth/2:item.requiresFrontPosition?item.frontPositionIn!:holeDepth/2;
        const vertical=item.run==="left-return"||item.run==="right-return";
        const x=item.run==="main"?item.positionIn:item.run==="island"?design.islandLeftOffsetIn!+item.positionIn:item.run==="left-return"?depth-front:design.wallAIn-depth+front;
        const y=item.run==="main"?depth-front:item.run==="island"?design.islandBackOffsetIn!+depth-front:item.positionIn;
        const w=vertical?holeDepth:item.widthIn,h=vertical?item.widthIn:holeDepth;
        return <g key={item.id}><rect x={x-w/2} y={y-h/2} width={w} height={h} fill="#fbf9f3" stroke="#9f4f35" strokeWidth={.65}/><text x={x} y={y} textAnchor="middle" fontSize={font*.75} fill="#843d26">{item.id==="sink"?"Sink":item.id==="cooktop"?"Cooking": "Opening"}</text></g>;
      })}
    </svg>
    <div className="kitchen-designer-review"><h3>Openings and cutouts</h3>
      {!schedule.length?<p>No openings selected.</p>:<table><thead><tr><th>Opening</th><th>Run</th><th>Template W × D</th><th>Along run</th><th>From front</th></tr></thead><tbody>{schedule.map(item=><tr key={item.id}><td>{item.label}</td><td>{item.run?getCountertopCutoutRunLabel(item.run):"Not placed"}</td><td>{item.widthIn??"Unresolved"} × {item.depthIn??(item.placementKind==="full-depth-gap"?"Full depth":"Unresolved")}</td><td>{item.positionIn??"Unresolved"}</td><td>{item.requiresFrontPosition?item.frontPositionIn??"Unresolved":"Edge / full depth"}</td></tr>)}</tbody></table>}
      <p>Edge: {design.edge}. Backsplash: {design.backsplash}. Waterfall: {design.waterfall}.</p>
      {diagnostics.length>0&&<div><h3>Still needs review</h3>{diagnostics.map(problem=><p key={problem.id}>{problem.label}</p>)}</div>}
    </div>
  </section>;
}
