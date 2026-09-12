import { describe,it,expect,vi } from "vitest";
import fs from "node:fs";
import { createHash } from "node:crypto";
vi.mock("../routes/direct-connect/estimate-home-timeline",()=>({appendEstimateHomeTimeline:vi.fn()}));
import { registerDirectConnectJobLifecycleRoutes as current } from "../routes/direct-connect/job-lifecycle";
import { registerDirectConnectJobLifecycleRoutes as preserved } from "../routes/direct-connect/job-lifecycle-preserved";
import { ESTIMATE_ROUTE_KEYS } from "../routes/direct-connect/estimate-handlers";

function capture(register:any){
 const routes:any[]=[];
 const app:any={};for(const method of ['get','post','patch','delete','put'])app[method]=(route:string,...handlers:any[])=>{routes.push({key:method+' '+route,handlers});return app;};
 const auth=()=>{};register(app,{isAuthenticated:auth});return {routes,auth};
}
describe("Estimate route composition",()=>{
 it("replaces exactly six final callbacks without changing method, path, middleware or order",()=>{
  const old=capture(preserved),next=capture(current);
  expect(next.routes.map(r=>r.key)).toEqual(old.routes.map(r=>r.key));
  for(let i=0;i<old.routes.length;i++){
   const a=old.routes[i],b=next.routes[i];
   expect(b.handlers.length).toBe(a.handlers.length);expect(b.handlers[0]).toBe(next.auth);
   if(ESTIMATE_ROUTE_KEYS.includes(a.key))expect(b.handlers.at(-1).toString()).not.toBe(a.handlers.at(-1).toString());
   else expect(b.handlers.at(-1).toString()).toBe(a.handlers.at(-1).toString());
  }
  for(const key of ESTIMATE_ROUTE_KEYS)expect(next.routes.filter(r=>r.key===key)).toHaveLength(1);
 });
 it("preserves the entire original lifecycle source, not a reconstructed copy",()=>{
  const source=fs.readFileSync('server/routes/direct-connect/job-lifecycle-preserved.ts');
  expect(createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex')).toBe('47cf3dc4c32ee35f702203b811a2fe42b34215b7');
 });
});
