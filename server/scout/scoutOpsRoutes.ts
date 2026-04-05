import type { Router } from "express";

type RegisterScoutOpsRoutesOptions = {
  getKnowledgeBaseStatus: () => {
    knowledgeBasePresent?: boolean;
    manualCachePresent?: boolean;
    autoCachePresent?: boolean;
  };
  loadSystemPrompt: () => { content: string; version: string };
  generateAutoPrompt: () => Promise<{
    autoPrompt: string;
    suggestions: string[];
    source: "gemini" | "fallback";
  }>;
};

export function registerScoutOpsRoutes(
  router: Router,
  options: RegisterScoutOpsRoutesOptions
): void {
  const { getKnowledgeBaseStatus, loadSystemPrompt, generateAutoPrompt } = options;

  router.get("/health", (_req, res) => {
    let knowledgeBasePresent = false;
    let manualCachePresent = false;
    let autoCachePresent = false;
    try {
      const status = getKnowledgeBaseStatus();
      knowledgeBasePresent = Boolean(status.knowledgeBasePresent);
      manualCachePresent = Boolean(status.manualCachePresent);
      autoCachePresent = Boolean(status.autoCachePresent);
    } catch {
      // ignore
    }
    const buildId =
      process.env.RENDER_GIT_COMMIT ||
      process.env.GITHUB_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.COMMIT_REF ||
      null;
    res.json({
      status: "ok",
      buildId,
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      knowledgeBasePresent,
      manualCachePresent,
      autoCachePresent,
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/auto-prompt", async (_req, res) => {
    const { content: systemPrompt, version: promptVersion } = loadSystemPrompt();
    const auto = await generateAutoPrompt();

    res.json({
      autoPrompt: auto.autoPrompt,
      suggestions: auto.suggestions,
      source: auto.source,
      promptVersion,
      systemPromptBytes: systemPrompt.length,
    });
  });
}
