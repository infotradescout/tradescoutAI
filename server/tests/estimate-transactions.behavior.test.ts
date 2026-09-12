import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { lockEstimate, addEstimateLine, sendEstimate, respondToEstimate } from "../routes/direct-connect/estimate-transactions";

const pg = new PGlite();
const dialect = new PgDialect();
let failAt: string | null = null;
function executor(connection: any) {
  return { execute: async (statement: any) => {
    const q = dialect.sqlToQuery(statement);
    if (failAt && q.sql.includes(failAt)) throw new Error("Injected persistence failure");
    return connection.query(q.sql,q.params);
  } };
}
const supplier = {userId:"supplier",contractorId:null,workerId:null};
async function edit(work: (tx:any,estimate:any)=>Promise<any>) {
  return pg.transaction(async c => {const tx=executor(c);return work(tx,await lockEstimate(tx,"job","estimate"));});
}
const line = (type:string,cost:number,quantity=1)=>({lineType:type,name:"Synthetic "+type,quantity,unit:"each",unitCost:cost});
const add = (type:string,cost:number,quantity=1,key?:string)=>edit((tx,e)=>addEstimateLine(tx,e,supplier,line(type,cost,quantity),key));
const send = ()=>edit((tx,e)=>sendEstimate(tx,e,supplier,"Synthetic offer only"));
const respond = (decision:string)=>edit((tx,e)=>respondToEstimate(tx,e,"customer",decision));
async function row(){return (await pg.query<any>("SELECT * FROM job_estimates WHERE id='estimate'")).rows[0];}
async function count(table:string){return Number((await pg.query<any>(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);}

beforeAll(async()=>{await pg.exec(`
 CREATE TABLE direct_connect_dispatch_requests(id text PRIMARY KEY,contact_gate_state text);
 CREATE TABLE direct_connect_job_workspaces(id text PRIMARY KEY,active_stage text,status text,updated_at timestamptz);
 CREATE TABLE direct_connect_dispatch_candidates(id text PRIMARY KEY,request_id text,eligibility_state text,responder_user_id text,contractor_id text,worker_id text);
 CREATE TABLE job_estimates(id text PRIMARY KEY,workspace_id text,request_id text,requester_user_id text,created_by text,status text,subtotal_materials numeric DEFAULT 0,subtotal_labor numeric DEFAULT 0,subtotal_other numeric DEFAULT 0,total_estimate numeric DEFAULT 0,sent_at timestamptz,responded_at timestamptz,updated_at timestamptz);
 CREATE TABLE job_estimate_line_items(id text PRIMARY KEY,estimate_id text REFERENCES job_estimates(id),line_type text,name text,description text,quantity numeric,unit text,rate numeric,unit_price numeric,total_cost numeric,supplier text,sku text,notes text,created_at timestamptz);
 CREATE TABLE direct_connect_dispatch_events(event_id text PRIMARY KEY,request_id text REFERENCES direct_connect_dispatch_requests(id),actor_type text,actor_id text,event_type text,metadata_json jsonb,created_at timestamptz);
 CREATE TABLE direct_connect_lifecycle_notifications(id text PRIMARY KEY,request_id text,actor_type text,actor_id text,recipient_type text,recipient_id text,event_type text,lifecycle_status text,message_key text,message_text text,is_read boolean,created_at timestamptz);
 CREATE TABLE direct_connect_notifications(id text PRIMARY KEY,request_id text,job_workspace_id text,event_id text REFERENCES direct_connect_dispatch_events(event_id),recipient_user_id text,recipient_role text,actor_type text,actor_id text,notification_type text,title text,message text,action_key text,status text,priority text,metadata_json jsonb,created_at timestamptz);
 CREATE TABLE job_acceptances(id text PRIMARY KEY,workspace_id text,estimate_id text,accepted_by text,accepted_at timestamptz,note text);
`);});
afterAll(async()=>{await pg.close();});
beforeEach(async()=>{
 failAt=null;
 await pg.exec(`TRUNCATE job_acceptances,direct_connect_notifications,direct_connect_lifecycle_notifications,direct_connect_dispatch_events,job_estimate_line_items,job_estimates,direct_connect_dispatch_candidates,direct_connect_job_workspaces,direct_connect_dispatch_requests;
 INSERT INTO direct_connect_dispatch_requests VALUES('request','released');
 INSERT INTO direct_connect_job_workspaces VALUES('job','estimate','estimate_draft',now());
 INSERT INTO direct_connect_dispatch_candidates VALUES('candidate','request','eligible','supplier',NULL,NULL);
 INSERT INTO job_estimates(id,workspace_id,request_id,requester_user_id,created_by,status) VALUES('estimate','job','request','customer','supplier','draft');`);
});

describe("Transactional estimates",()=>{
 it("adds 100+200+300+100 to exactly 700 without compounding other charges",async()=>{
   expect((await add("other",100)).totals.totalEstimate).toBe(100);
   expect((await add("other",200)).totals.totalEstimate).toBe(300);
   expect((await add("material",150,2)).totals.totalEstimate).toBe(600);
   expect((await add("labor",50,2)).totals).toEqual({subtotalMaterials:300,subtotalLabor:100,subtotalOther:300,totalEstimate:700});
 });
 it("retains a fixed initial allowance",async()=>{
   await pg.exec("UPDATE job_estimates SET subtotal_other=25,total_estimate=25");
   expect((await add("travel",10)).totals.totalEstimate).toBe(35);
   expect((await add("material",20)).totals.totalEstimate).toBe(55);
   expect((await add("disposal",5)).totals.totalEstimate).toBe(60);
 });
 it("rounds cents with the database numeric type",async()=>{
   expect((await add("equipment",10.125,2)).totals.totalEstimate).toBe(20.25);
   expect((await add("labor",1.25,2)).totals.totalEstimate).toBe(22.75);
   expect((await add("permits",0.25)).totals.totalEstimate).toBe(23);
 });
 it.each(["UPDATE job_estimates","INSERT INTO direct_connect_dispatch_events"])("rolls back a line if %s fails",async failing=>{
   failAt=failing;
   await expect(add("other",100)).rejects.toThrow("Injected persistence failure");
   expect(await count("job_estimate_line_items")).toBe(0);expect(Number((await row()).total_estimate)).toBe(0);
   failAt=null;expect((await add("other",100)).totals.totalEstimate).toBe(100);
 });
 it("replays an identified line without duplication and rejects changed content under the same key",async()=>{
   await add("other",100,1,"retry-key-123");
   expect((await add("other",100,1,"retry-key-123")).replayed).toBe(true);
   expect(await count("job_estimate_line_items")).toBe(1);
   await expect(add("other",200,1,"retry-key-123")).rejects.toMatchObject({status:409});
 });
 it.each(["UPDATE direct_connect_job_workspaces","INSERT INTO direct_connect_dispatch_events","INSERT INTO direct_connect_lifecycle_notifications","INSERT INTO direct_connect_notifications"])("rolls back send and permits retry when %s fails",async failing=>{
   await add("material",100);failAt=failing;
   await expect(send()).rejects.toThrow("Injected persistence failure");
   expect((await row()).status).toBe("draft");expect(await count("direct_connect_notifications")).toBe(0);
   failAt=null;expect((await send()).status).toBe("sent");
 });
 it("sends once and creates only the intended customer's receipt on replay",async()=>{
   await add("material",100);expect((await send()).replayed).toBe(false);expect((await send()).replayed).toBe(true);
   expect(await count("direct_connect_notifications")).toBe(1);
   const notice=(await pg.query<any>("SELECT * FROM direct_connect_notifications")).rows[0];
   expect(notice.recipient_user_id).toBe("customer");expect(notice.metadata_json.estimateId).toBe("estimate");expect(notice.action_key).toBe("review_estimate");
 });
 it("requires an item before sending",async()=>{await expect(send()).rejects.toMatchObject({status:409});expect((await row()).status).toBe("draft");});
 it("does not edit sent amounts",async()=>{await add("material",100);await send();await expect(add("other",50)).rejects.toMatchObject({status:409});expect(Number((await row()).total_estimate)).toBe(100);});
 it.each(["INSERT INTO job_acceptances","UPDATE direct_connect_job_workspaces","INSERT INTO direct_connect_notifications"])("rolls back customer acceptance when %s fails",async failing=>{
   await add("material",100);await send();failAt=failing;
   await expect(respond("accept")).rejects.toThrow("Injected persistence failure");
   expect((await row()).status).toBe("sent");expect(await count("job_acceptances")).toBe(0);
   failAt=null;await respond("accept");expect(await count("job_acceptances")).toBe(1);
 });
 it("replays the same customer decision once and rejects a conflicting terminal decision",async()=>{
   await add("material",100);await send();await respond("accept");expect((await respond("accept")).replayed).toBe(true);
   expect(await count("job_acceptances")).toBe(1);await expect(respond("decline")).rejects.toMatchObject({status:409});
 });
 it("supports request changes, revision and resend",async()=>{
   await add("material",100);await send();await respond("request_changes");await add("labor",50);await send();await respond("accept");
   expect(Number((await row()).total_estimate)).toBe(150);expect((await row()).status).toBe("accepted");
 });
 it("does not grant an unrelated account edit or response rights",async()=>{
   await expect(edit((tx,e)=>addEstimateLine(tx,e,{...supplier,userId:"stranger"},line("other",100)))).rejects.toMatchObject({status:403});
   await expect(edit((tx,e)=>respondToEstimate(tx,e,"supplier","accept"))).rejects.toMatchObject({status:403});
   expect(await count("job_estimate_line_items")).toBe(0);
 });
 it("keeps revoked contact blocked",async()=>{
   await pg.exec("UPDATE direct_connect_dispatch_requests SET contact_gate_state='denied'");
   await expect(add("other",100)).rejects.toMatchObject({status:409});
 });
});
