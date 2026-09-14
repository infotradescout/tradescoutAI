import type { Express, RequestHandler } from "express";
import {
  registerDirectConnectJobLifecycleRoutes as registerPreservedLifecycle,
  type DirectConnectJobLifecycleRouteDependencies,
} from "./job-lifecycle-preserved";
import { createEstimateHandlers, ESTIMATE_ROUTE_KEYS } from "./estimate-handlers";
import { appendEstimateHomeTimeline } from "./estimate-home-timeline";
export type { DirectConnectJobLifecycleRouteDependencies } from "./job-lifecycle-preserved";

/**
 * The public registration owner is unchanged. At composition time, replace
 * exactly six estimate callbacks, preserving their original authentication
 * middleware, URL, method and registration order. Every other lifecycle route
 * is registered byte-for-byte from the preserved module. No duplicate estimate
 * route or request-time fallback is registered.
 *
 * This boundary keeps the unrelated payments/schedules/completion code intact
 * while the six estimate handlers move to their transactional implementation.
 * The old estimate closures in the preserved registration source are never
 * installed. The replacement count is asserted so drift fails at startup.
 */
export function registerDirectConnectJobLifecycleRoutes(
  app: Express,
  dependencies: DirectConnectJobLifecycleRouteDependencies
) {
  const replacements=createEstimateHandlers({...dependencies,appendEstimateHomeTimeline});
  const installed=new Set<string>();
  const registration=new Proxy(app,{
    get(target,property,receiver) {
      if(property==='get'||property==='post'||property==='patch') {
        return (route:string,...handlers:RequestHandler[])=>{
          const key=String(property)+' '+route;
          const replacement=replacements.get(key);
          if(replacement) {
            if(installed.has(key)||handlers.length!==2||handlers[0]!==dependencies.isAuthenticated)
              throw new Error('Unexpected estimate middleware registration: '+key);
            installed.add(key);
            return (target[property] as any).call(target,route,handlers[0],replacement);
          }
          return (target[property] as any).call(target,route,...handlers);
        };
      }
      const value=Reflect.get(target,property,receiver);
      return typeof value==='function'?value.bind(target):value;
    },
  });
  registerPreservedLifecycle(registration,dependencies);
  if(installed.size!==ESTIMATE_ROUTE_KEYS.length)
    throw new Error('Incomplete transactional estimate route registration');
}
