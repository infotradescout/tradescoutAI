import { userHomeRecords } from "@shared/schema";
import { resolveHomeIdTimelineContextForRequest } from "./home-id";

/** Reuse the existing owned-home context resolution; only the write executor changes. */
export async function appendEstimateHomeTimeline(tx:any,params:{
  requestId:string;
  eventType:"direct_connect_estimate_sent"|"direct_connect_estimate_accepted";
  title:string;
  summary?:string|null;
}) {
  const context=await resolveHomeIdTimelineContextForRequest(params.requestId);
  if(!context)return;
  const now=new Date();const nowIso=now.toISOString();
  await tx.insert(userHomeRecords).values({
    homeId:context.homeId,createdByUserId:context.requestOwnerUserId,recordType:"note",
    title:`homeid:timeline:${params.eventType}`,
    details:JSON.stringify({homeId:context.homeId,directConnectRequestId:params.requestId,homePacketId:context.homePacketId||null,selectedDetailIds:context.selectedDetailIds,componentType:context.componentType||null,componentLabel:context.componentLabel||null,eventType:params.eventType,source:"direct_connect_jobflow",title:params.title,summary:params.summary||null,occurredAt:nowIso,createdAt:nowIso}),
    tags:["homeid","timeline","direct_connect_jobflow",params.eventType],occurredAt:now,updatedAt:now,
  } as any);
}
