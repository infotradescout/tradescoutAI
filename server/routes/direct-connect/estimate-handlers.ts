import type { Request, Response, RequestHandler } from "express";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  EstimateOperationError, addEstimateLine, lockEstimate, requireEstimateProvider,
  requireReleasedEstimateContact, recordEstimateEvent, estimateTotals, estimateMutationId,
  sendEstimate, respondToEstimate, type EstimateActor,
} from "./estimate-transactions";

type Dependencies = Record<string, any>;
const first = (result:any) => result.rows?.[0] || null;
const fail = (status:number,message:string):never => {throw new EstimateOperationError(status,message);};

/** Existing endpoint keys; middleware is supplied by the original route owner. */
export const ESTIMATE_ROUTE_KEYS = [
  "post /api/direct-connect/jobs/:jobWorkspaceId/estimates",
  "post /api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/line-items",
  "get /api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId",
  "patch /api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId",
  "post /api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/send",
  "post /api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/respond",
] as const;

export function createEstimateHandlers(deps:Dependencies):Map<string,RequestHandler> {
  const handlers=new Map<string,RequestHandler>();
  const define=(index:number,schemaName:string|null,operation:(tx:any,req:Request,payload:any,actor:EstimateActor)=>Promise<any>,status=200)=>{
    handlers.set(ESTIMATE_ROUTE_KEYS[index],async(req:Request & {user?:any},res:Response)=>{
      try {
        const userId=String(req.user?.id||req.user?.claims?.sub||"").trim();
        if(!userId)fail(401,"Unauthorized");
        if(!String(req.params.jobWorkspaceId||"").trim())fail(400,"Job workspace id is required");
        const parsed=schemaName?deps[schemaName].safeParse(req.body??{}):{success:true,data:{}};
        if(!parsed.success)return res.status(400).json({message:"Invalid estimate payload",issues:parsed.error.flatten()});
        const contractor=await deps.storage.getContractorByUserId(userId);
        const workerRows=await deps.db.select({id:deps.workers.id}).from(deps.workers).where(deps.eq(deps.workers.userId,userId)).limit(1);
        const actor={userId,contractorId:contractor?.id?String(contractor.id):null,workerId:workerRows[0]?.id?String(workerRows[0].id):null};
        const result=await deps.db.transaction((tx:any)=>operation(tx,req,parsed.data,actor));
        res.setHeader("Cache-Control","private, no-store");
        return res.status(status).json(result);
      } catch(error) {
        if(error instanceof EstimateOperationError)return res.status(error.status).json({message:error.message});
        console.error("Estimate transaction failed:",error);
        // Connection failure during COMMIT can leave the outcome uncertain.
        // The client must read/retry by operation key, not assume nothing saved.
        return res.status(500).json({message:"The estimate operation could not be confirmed. Reload its saved state before retrying.",requestId:(req as any).requestId||null});
      }
    });
  };
  define(0,"estimateCreateSchema",async(tx,req,p,actor)=>{
    const workspace=first(await tx.execute(sql`SELECT * FROM direct_connect_job_workspaces WHERE id=${req.params.jobWorkspaceId} FOR UPDATE`));
    if(!workspace)fail(404,"Job workspace not found");
    await requireReleasedEstimateContact(tx,String(workspace.request_id));
    await requireEstimateProvider(tx,workspace,actor);
    const key=req.get("Idempotency-Key");
    const id=key?estimateMutationId("create:"+String(workspace.id),actor.userId,key).replace(/^eli_/,"est_"):deps.createId("est");
    const values={title:p.title.trim(),scopeSummary:p.scopeSummary.trim(),subtotalOther:p.subtotalOther??0,terms:p.terms?.trim()||null,expirationDate:p.expirationDate?new Date(p.expirationDate).toISOString():null};
    const fingerprint=createHash("sha256").update(JSON.stringify(values)).digest("hex");
    if(key){
      const existing=first(await tx.execute(sql`SELECT * FROM job_estimates WHERE id=${id} AND workspace_id=${req.params.jobWorkspaceId} FOR UPDATE`));
      if(existing){
        if(String(existing.created_by)!==actor.userId||String(existing.request_id)!==String(workspace.request_id))fail(409,"Estimate creation key conflicts with an existing record.");
        const receipt=first(await tx.execute(sql`SELECT metadata_json FROM direct_connect_dispatch_events WHERE request_id=${String(workspace.request_id)} AND event_type='estimate_started' AND metadata_json->>'estimateId'=${id} AND metadata_json->>'creationFingerprint'=${fingerprint} LIMIT 1`));
        if(!receipt)fail(409,"Idempotency-Key already identifies a different estimate creation.");
        return {estimateId:id,jobWorkspaceId:req.params.jobWorkspaceId,status:String(existing.status),requestId:String(workspace.request_id),replayed:true};
      }
    }
    const estimate=first(await tx.execute(sql`
      INSERT INTO job_estimates(id,workspace_id,request_id,requester_user_id,business_id,contractor_id,title,scope_summary,status,subtotal_materials,subtotal_labor,subtotal_other,total_estimate,terms,expiration_date,created_by,created_at,updated_at)
      VALUES(${id},${req.params.jobWorkspaceId},${String(workspace.request_id)},${String(workspace.requester_user_id)},${workspace.business_id||null},${workspace.contractor_id||actor.contractorId},${values.title},${values.scopeSummary},'draft',0,0,${values.subtotalOther},${values.subtotalOther},${values.terms},${values.expirationDate}::timestamptz,${actor.userId},now(),now()) RETURNING *
    `));
    await tx.execute(sql`UPDATE direct_connect_job_workspaces SET active_stage='estimate',status='estimate_draft',updated_at=now() WHERE id=${req.params.jobWorkspaceId}`);
    await recordEstimateEvent(tx,{estimate,actorId:actor.userId,eventType:"estimate_started",metadata:{creationFingerprint:fingerprint}});
    return {estimateId:id,jobWorkspaceId:req.params.jobWorkspaceId,status:"draft",requestId:String(workspace.request_id),replayed:false};
  },201);
  define(1,"estimateLineItemSchema",async(tx,req,p,actor)=>{
    const estimate=await lockEstimate(tx,req.params.jobWorkspaceId,req.params.estimateId);
    return addEstimateLine(tx,estimate,actor,p,req.get("Idempotency-Key"));
  },201);
  define(2,null,async(tx,req,_p,actor)=>{
    const e=await lockEstimate(tx,req.params.jobWorkspaceId,req.params.estimateId,true);
    if(String(e.requester_user_id)===actor.userId){if(e.status==="draft")fail(404,"Estimate not available");}
    else await requireEstimateProvider(tx,e,actor);
    const lines=await tx.execute(sql`SELECT * FROM job_estimate_line_items WHERE estimate_id=${String(e.id)} ORDER BY created_at ASC,id ASC`);
    return {estimateId:String(e.id),jobWorkspaceId:String(e.workspace_id),requestId:String(e.request_id),title:String(e.title||""),scopeSummary:String(e.scope_summary||""),status:String(e.status),...estimateTotals(e),terms:e.terms||null,expirationDate:e.expiration_date||null,sentAt:e.sent_at||null,respondedAt:e.responded_at||null,createdAt:e.created_at||null,updatedAt:e.updated_at||null,
      lineItems:(lines.rows||[]).map((item:any)=>({id:String(item.id),lineType:String(item.line_type),name:String(item.name),description:item.description||null,quantity:Number(item.quantity),unit:item.unit||null,rate:item.rate===null?null:Number(item.rate),unitCost:item.unit_price===null?null:Number(item.unit_price),totalCost:Number(item.total_cost),supplier:item.supplier||null,sku:item.sku||null,notes:item.notes||null}))};
  });
  define(3,"estimateUpdateSchema",async(tx,req,p,actor)=>{
    const e=await lockEstimate(tx,req.params.jobWorkspaceId,req.params.estimateId);
    await requireEstimateProvider(tx,e,actor);await requireReleasedEstimateContact(tx,String(e.request_id));
    if(!["draft","change_requested"].includes(e.status))fail(409,"Only draft or change-requested estimates can be revised.");
    if(p.status&&!['draft','change_requested','void'].includes(p.status))fail(400,"Use the send or response action to change estimate status.");
    await tx.execute(sql`UPDATE job_estimates SET title=COALESCE(${p.title?.trim()||null},title),scope_summary=COALESCE(${p.scopeSummary?.trim()||null},scope_summary),terms=COALESCE(${p.terms?.trim()||null},terms),expiration_date=COALESCE(${p.expirationDate?new Date(p.expirationDate).toISOString():null}::timestamptz,expiration_date),status=COALESCE(${p.status??null},status),updated_at=now() WHERE id=${String(e.id)}`);
    await recordEstimateEvent(tx,{estimate:e,actorId:actor.userId,eventType:p.status==='void'?'estimate_voided':'estimate_started',metadata:{revised:true}});
    return {ok:true,estimateId:String(e.id)};
  });
  define(4,"estimateSendSchema",async(tx,req,p,actor)=>{
    const e=await lockEstimate(tx,req.params.jobWorkspaceId,req.params.estimateId);
    const result=await sendEstimate(tx,e,actor,p.note);
    if(!result.replayed)await deps.appendEstimateHomeTimeline(tx,{requestId:String(e.request_id),eventType:"direct_connect_estimate_sent",title:"Estimate sent",summary:"A contractor sent an estimate for this request."});
    return result;
  });
  define(5,"estimateRespondSchema",async(tx,req,p,actor)=>{
    const e=await lockEstimate(tx,req.params.jobWorkspaceId,req.params.estimateId);
    const result=await respondToEstimate(tx,e,actor.userId,p.decision,p.note);
    if(!result.replayed&&result.status==='accepted')await deps.appendEstimateHomeTimeline(tx,{requestId:String(e.request_id),eventType:"direct_connect_estimate_accepted",title:"Estimate accepted",summary:"The request owner accepted an estimate."});
    return result;
  });
  return handlers;
}
