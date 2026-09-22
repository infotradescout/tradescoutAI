import type { Request, Response } from "express";
import { reportRequestStages, validateWindow, type RequestStageClient } from "../../scripts/report-discovery-request-stages.mjs";
import { projectRequestStagesReport } from "../../shared/discoveryRequestStages";

type Client = RequestStageClient & { release(): void };
type Dependencies = { connect(): Promise<Client>; now?: () => Date };

/** Registered after the existing authenticated super-admin middleware only. */
export function createRequestStagesHandler(dependencies: Dependencies) {
  return async (req: Request, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    let window: { from: string; to: string };
    try {
      if (Object.keys(req.query).some((key) => key !== "from" && key !== "to")) throw new Error("Unknown filter");
      window = validateWindow(req.query.from, req.query.to);
      if (Date.parse(window.to) > (dependencies.now?.() || new Date()).getTime()) throw new Error("Future report end");
    } catch {
      res.status(400).json({ message: "Choose explicit UTC dates, ending no later than now, for a window of at most 90 days. The end is exclusive." });
      return;
    }
    let client: Client | undefined;
    try {
      client = await dependencies.connect();
      const report = projectRequestStagesReport(await reportRequestStages(client, window.from, window.to));
      res.json({ report, generatedAt: new Date().toISOString() });
    } catch {
      res.status(503).json({ message: "Request outcome evidence is unavailable. No missing counts were replaced with zero." });
    } finally {
      client?.release();
    }
  };
}
