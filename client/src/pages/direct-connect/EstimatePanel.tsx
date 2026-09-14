import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type LineItem = { id:string;lineType:string;name:string;quantity:number;unit:string|null;unitCost:number|null;totalCost:number };
type EstimateDetail = { estimateId:string;jobWorkspaceId:string;requestId:string;title:string;scopeSummary:string;status:"draft"|"sent"|"accepted"|"change_requested"|"declined"|"expired"|"void";totalEstimate:number;lineItems:LineItem[] };
const LINE_TYPES=["material","labor","permits","disposal","travel","equipment","other"] as const;
const money=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);
const rootPath=(workspace:string)=>`/api/direct-connect/jobs/${encodeURIComponent(workspace)}/estimates`;
const freshLine=()=>({lineType:"material" as string,name:"",quantity:"1",unit:"each",unitCost:""});
function rememberedEstimate(workspace:string){
  if(typeof window==='undefined')return null;
  const query=new URLSearchParams(window.location.search);
  return query.get('jobWorkspaceId')===workspace?query.get('estimateId'):null;
}
function rememberEstimate(workspace:string,id:string){
  const url=new URL(window.location.href);
  url.searchParams.set('jobWorkspaceId',workspace);url.searchParams.set('estimateId',id);
  // The identifier is not authorization. Reading its contents still requires
  // the server's exact customer/author checks. No rates or lines are stored here.
  window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
}
function QuoteLines({estimate}:{estimate:EstimateDetail}){
  return <div data-testid="estimate-saved-lines" className="space-y-2">
    {estimate.lineItems.map(line=><div key={line.id} className="flex min-w-0 items-start justify-between gap-4 text-sm">
      <span className="min-w-0 break-words">{line.name}<span className="block text-xs text-[color:var(--text-secondary)]">{line.quantity} {line.unit} · {line.lineType}</span></span>
      <span className="shrink-0 tabular-nums">{money(line.totalCost)}</span>
    </div>)}
    <div className="flex justify-between gap-4 border-t border-[color:var(--border-subtle)] pt-3 font-semibold"><span>Total</span><span data-testid="estimate-saved-total" className="tabular-nums">{money(estimate.totalEstimate)}</span></div>
  </div>;
}
function ErrorPanel({error,retry}:{error:unknown;retry:()=>void}){
  return <div role="alert" className="space-y-2 text-sm"><p>{formatUserFacingErrorMessage(error,"This estimate could not be loaded. Your access and its current saved state must be checked before continuing.")}</p><Button variant="outline" onClick={retry}>Retry loading estimate</Button></div>;
}

export function CreateEstimatePanel(props:{jobWorkspaceId:string;onCreated?:(estimateId:string)=>void}){
  const {user}=useAuth();
  if(!user?.id)return <p className="text-sm">Sign in to create or resume your estimate.</p>;
  return <EstimateEditor key={`${user.id}:${props.jobWorkspaceId}`} {...props} accountId={String(user.id)}/>;
}
function EstimateEditor({jobWorkspaceId,accountId,onCreated}:{jobWorkspaceId:string;accountId:string;onCreated?:(id:string)=>void}){
  const {toast}=useToast();const queries=useQueryClient();
  const [estimateId,setEstimateId]=useState<string|null>(()=>rememberedEstimate(jobWorkspaceId));
  const [title,setTitle]=useState('');const [scopeSummary,setScopeSummary]=useState('');const [draft,setDraft]=useState(freshLine);
  const pendingLine=useRef<{signature:string;key:string}|null>(null);
  const pendingCreate=useRef<{signature:string;key:string}|null>(null);
  const queryKey=['estimate',accountId,jobWorkspaceId,estimateId];
  const detail=useQuery<EstimateDetail>({queryKey,enabled:!!estimateId,retry:false,queryFn:()=>apiRequest('GET',rootPath(jobWorkspaceId)+'/'+encodeURIComponent(estimateId!))});
  const refresh=()=>queries.invalidateQueries({queryKey});
  const report=(heading:string,error:unknown)=>toast({title:heading,description:formatUserFacingErrorMessage(error,'The operation could not be confirmed. Reload the saved estimate before retrying.'),variant:'destructive'});
  function operationKey(ref:typeof pendingLine,payload:unknown){const signature=JSON.stringify(payload);if(ref.current?.signature!==signature)ref.current={signature,key:crypto.randomUUID()};return ref.current!.key;}
  const create=useMutation({
    mutationFn:(payload:{title:string;scopeSummary:string})=>apiRequest(rootPath(jobWorkspaceId),{method:'POST',data:payload,headers:{'Idempotency-Key':operationKey(pendingCreate,payload)}}),
    onSuccess:(data:any)=>{pendingCreate.current=null;setEstimateId(data.estimateId);rememberEstimate(jobWorkspaceId,data.estimateId);onCreated?.(data.estimateId);},
    onError:(error)=>report('Could not start estimate',error),
  });
  const add=useMutation({
    mutationFn:(payload:any)=>apiRequest(rootPath(jobWorkspaceId)+'/'+encodeURIComponent(estimateId!)+'/line-items',{method:'POST',data:payload,headers:{'Idempotency-Key':operationKey(pendingLine,payload)}}),
    onSuccess:()=>{pendingLine.current=null;setDraft(freshLine());void refresh();},
    onError:(error)=>report('Could not add line item',error),
  });
  const send=useMutation({mutationFn:()=>apiRequest('POST',rootPath(jobWorkspaceId)+'/'+encodeURIComponent(estimateId!)+'/send',{}),onSuccess:()=>{void refresh();toast({title:'Estimate available to requester'});},onError:(error)=>report('Could not send estimate',error)});
  const estimate=detail.data;const editable=estimate&&['draft','change_requested'].includes(estimate.status);
  const busy=create.isPending||add.isPending||send.isPending||detail.isFetching;
  const quantity=Number(draft.quantity),unitCost=Number(draft.unitCost);
  const validLine=draft.name.trim().length>=2&&draft.unit.trim().length>0&&draft.quantity.trim()!==''&&draft.unitCost.trim()!==''&&Number.isFinite(quantity)&&quantity>0&&Number.isFinite(unitCost)&&unitCost>=0;
  return <Card data-testid="estimate-editor" className="min-w-0 border-ts-orange/35 bg-[color:var(--surface-card)]"><CardHeader><CardTitle className="text-base">{estimate?'Saved estimate':'Create estimate'}</CardTitle></CardHeader><CardContent className="space-y-4">
    {!estimateId?<>
      <Input aria-label="Estimate title" value={title} disabled={busy} onChange={e=>setTitle(e.target.value)} placeholder="Estimate title"/>
      <Textarea aria-label="Scope of work" value={scopeSummary} disabled={busy} onChange={e=>setScopeSummary(e.target.value)} placeholder="Scope of work (what's included)" className="min-h-[100px]"/>
      <Button onClick={()=>create.mutate({title:title.trim(),scopeSummary:scopeSummary.trim()})} disabled={busy||title.trim().length<3||scopeSummary.trim().length<10}>Start estimate</Button>
    </>:detail.isError?<ErrorPanel error={detail.error} retry={()=>{void detail.refetch();}}/>:!estimate?<p role="status">Loading saved estimate…</p>:<>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="min-w-0 break-words font-semibold">{estimate.title}</h3><Badge variant="outline">{estimate.status.replaceAll('_',' ')}</Badge></div>
      <p className="break-words text-sm text-[color:var(--text-secondary)]">{estimate.scopeSummary}</p>
      <QuoteLines estimate={estimate}/>
      {editable?<>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 text-sm">Item type<select aria-label="Item type" value={draft.lineType} disabled={busy} onChange={e=>setDraft(v=>({...v,lineType:e.target.value}))} className="mt-1 block w-full rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-2 text-[color:var(--text-primary)]">{LINE_TYPES.map(type=><option key={type} value={type}>{type.charAt(0).toUpperCase()+type.slice(1)}</option>)}</select></label>
          <Input aria-label="Item name" placeholder="Item name" value={draft.name} disabled={busy} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} className="col-span-2"/>
          <Input aria-label="Quantity" placeholder="Qty" type="number" min="0.001" step="any" value={draft.quantity} disabled={busy} onChange={e=>setDraft(v=>({...v,quantity:e.target.value}))}/>
          <Input aria-label="Unit cost" placeholder="Unit cost" type="number" min="0" step="0.01" value={draft.unitCost} disabled={busy} onChange={e=>setDraft(v=>({...v,unitCost:e.target.value}))}/>
          <Input aria-label="Unit" placeholder="Unit" value={draft.unit} disabled={busy} onChange={e=>setDraft(v=>({...v,unit:e.target.value}))} className="col-span-2"/>
        </div>
        <Button variant="outline" disabled={busy||!validLine} onClick={()=>add.mutate({lineType:draft.lineType,name:draft.name.trim(),quantity,unit:draft.unit.trim(),unitCost})}>Add line item</Button>
        <Button disabled={busy||estimate.lineItems.length===0} onClick={()=>send.mutate()} className="w-full bg-ts-orange text-text-black hover:bg-ts-orange/90">Send estimate to requester</Button>
      </>:<p role="status" className="text-sm">{estimate.status==='sent'?'This estimate is available for the requester to review.':'This estimate is '+estimate.status.replaceAll('_',' ')+'.'} Email delivery is not confirmed by this screen.</p>}
      <Button variant="outline" disabled={busy} onClick={()=>{void detail.refetch();}}>Reload saved estimate</Button>
    </>}
  </CardContent></Card>;
}

export function ReviewEstimatePanel(props:{jobWorkspaceId:string;estimateId:string}){
  const {user}=useAuth();
  if(!user?.id)return <p className="text-sm">Sign in to review this estimate.</p>;
  return <EstimateReview key={`${user.id}:${props.jobWorkspaceId}:${props.estimateId}`} {...props} accountId={String(user.id)}/>;
}
function EstimateReview({jobWorkspaceId,estimateId,accountId}:{jobWorkspaceId:string;estimateId:string;accountId:string}){
  const {toast}=useToast();const queryClient=useQueryClient();const [note,setNote]=useState('');
  const queryKey=['estimate',accountId,jobWorkspaceId,estimateId];
  const detail=useQuery<EstimateDetail>({queryKey,retry:false,queryFn:()=>apiRequest('GET',rootPath(jobWorkspaceId)+'/'+encodeURIComponent(estimateId))});
  const respond=useMutation({mutationFn:(decision:'accept'|'request_changes'|'decline')=>apiRequest('POST',rootPath(jobWorkspaceId)+'/'+encodeURIComponent(estimateId)+'/respond',{decision,note:note.trim()||undefined}),onSuccess:()=>{void queryClient.invalidateQueries({queryKey});toast({title:'Estimate response saved'});},onError:(error)=>toast({title:'Could not confirm response',description:formatUserFacingErrorMessage(error,'Reload the estimate to check its saved status before retrying.'),variant:'destructive'})});
  const estimate=detail.data;
  return <Card data-testid="estimate-review" className="min-w-0 border-ts-orange/35 bg-[color:var(--surface-card)]"><CardHeader><CardTitle className="break-words text-base">{estimate?.title||'Review estimate'}</CardTitle></CardHeader><CardContent className="space-y-3">
    {detail.isError?<ErrorPanel error={detail.error} retry={()=>{void detail.refetch();}}/>:!estimate?<p role="status">Loading estimate…</p>:<>
      <Badge variant="outline">{estimate.status.replaceAll('_',' ')}</Badge>
      <p className="break-words text-sm text-[color:var(--text-secondary)]">{estimate.scopeSummary}</p><QuoteLines estimate={estimate}/>
      {estimate.status==='sent'?<><Textarea aria-label="Response note" placeholder="Optional note" value={note} disabled={respond.isPending} onChange={e=>setNote(e.target.value)} className="min-h-[70px]"/><div className="flex flex-wrap gap-2">
        <Button disabled={respond.isPending||detail.isFetching} onClick={()=>respond.mutate('accept')} className="bg-ts-orange text-text-black hover:bg-ts-orange/90">Accept</Button>
        <Button variant="outline" disabled={respond.isPending||detail.isFetching} onClick={()=>respond.mutate('request_changes')}>Request changes</Button>
        <Button variant="outline" disabled={respond.isPending||detail.isFetching} onClick={()=>respond.mutate('decline')}>Decline</Button>
      </div></>:<p role="status" className="text-sm">{estimate.status==='accepted'?'Estimate accepted. Scheduling and any further approvals remain separate.':estimate.status==='change_requested'?'Your change request is saved. The business can revise and resend the estimate.':`Estimate ${estimate.status.replaceAll('_',' ')}.`}</p>}
    </>}
  </CardContent></Card>;
}
