import type { Router } from "express";
import { readEcosystemPublicLinkPointer } from "../../shared/ecosystemPublicLink";
import { createEcosystemPublicLinkReceiver, type ReceiverDependencies } from "../services/ecosystemPublicLinkReceiver";

export function registerEcosystemPublicLinkReceiverRoutes(router: Router, deps: ReceiverDependencies) {
  const resolve = createEcosystemPublicLinkReceiver(deps);
  router.get("/api/u/:slug/ecosystem-links/:app/:tenantId/:sourceId", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    const slug = String(req.params.slug);
    const pointer = readEcosystemPublicLinkPointer({ app: req.params.app, tenantId: req.params.tenantId, sourceId: req.params.sourceId });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120 || !pointer || Object.keys(req.query).length) {
      return res.status(404).json({ state: "unavailable", reference: null });
    }
    const result = await resolve(slug, pointer);
    return res.status(result.state === "available" ? 200 : 404).json(result);
  });
}
