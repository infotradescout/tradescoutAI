import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import fs from "node:fs";
const { infer } = vi.hoisted(() => ({ infer: vi.fn() }));
vi.mock("../services/aiInference.js", () => ({ callAIInference: infer }));
vi.mock("../services/logger", () => ({ logger: { error: vi.fn() } }));
import { handleAIInference } from "../routes/ai-inference";

const body = {
  systemPrompt: "Return JSON.",
  userPrompt: "Synthetic county intent",
  temperature: 0.3,
  maxTokens: 500,
};
function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("authenticated inference handler boundary", () => {
  beforeEach(() => {
    infer.mockReset().mockResolvedValue({ content: '{"suggestions":[]}' });
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(["gpt-6-astra", "gpt-6-luna", "gpt-5.4-nano", null])(
    "rejects HTTP model %s before inference work",
    async (model) => {
      const res = response();
      await handleAIInference({ body: { ...body, model } } as Request, res as unknown as Response);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Inference model is configured by the server",
      });
      expect(infer).not.toHaveBeenCalled();
    }
  );

  it("forwards only inference fields and preserves success shape", async () => {
    const res = response();
    await handleAIInference(
      {
        body: { ...body, admin: true, confirmedClaimTypes: ["verified"], contact: true },
      } as Request,
      res as unknown as Response
    );
    expect(infer).toHaveBeenCalledExactlyOnceWith(body);
    expect(res.json).toHaveBeenCalledWith({ content: '{"suggestions":[]}' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("preserves missing-prompt validation without inference work", async () => {
    const res = response();
    await handleAIInference(
      { body: { userPrompt: "test" } } as Request,
      res as unknown as Response
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "systemPrompt and userPrompt are required" });
    expect(infer).not.toHaveBeenCalled();
  });

  it("preserves the generic HTTP error on provider failure", async () => {
    infer.mockRejectedValue(new Error("synthetic provider failure"));
    const res = response();
    await handleAIInference({ body } as Request, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "AI inference failed" });
  });

  it("keeps one POST registration with auth before rate limiting before the handler", () => {
    const source = fs.readFileSync("server/routes.ts", "utf8");
    const registrations = source.match(/app\.post\("\/api\/ai\/inference"[^;]+;/g);
    expect(registrations).toEqual([
      'app.post("/api/ai/inference", isAuthenticated, aiLimiter, handleAIInference);',
    ]);
  });
});
