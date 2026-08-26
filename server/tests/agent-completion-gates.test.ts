import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyAgentCompletion } from "../../agent-runtime/completion-state.js";
import { createBuilderAgent } from "../../agent-runtime/agents/builder.agent.js";
import { createFixerAgent } from "../../agent-runtime/agents/fixer.agent.js";
import { createVerifierAgent } from "../../agent-runtime/agents/verifier.agent.js";
import { createSynthesizerAgent } from "../../agent-runtime/agents/synthesizer.agent.js";

const logger = {
  info: vi.fn(async () => undefined),
  warn: vi.fn(async () => undefined),
  error: vi.fn(async () => undefined),
};

async function executeTimed(agent: ReturnType<typeof createFixerAgent>) {
  vi.useFakeTimers();
  const resultPromise = agent.execute("proof-required", logger);
  await vi.runAllTimersAsync();
  return resultPromise;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("agent completion gates", () => {
  it("blocks unsupported builder work instead of manufacturing a skipped test", async () => {
    const result = await createBuilderAgent().execute(
      { intent: "generic feature request" },
      logger
    );

    expect(result.artifact.type).toBe("builder-blocked");
    expect(result.completion).toBe("blocked");
    expect(result.artifact.files_changed).toBe(0);
    expect(classifyAgentCompletion(result)).toBe("blocked");
  });

  it("does not accept a valid-looking self-reported branch without trusted audit", () => {
    const result = {
      completion: "success",
      artifact: {
        type: "git-branch",
        uri: "local://branch/invented",
        commit: "a".repeat(40),
        files_changed: 12,
      },
    };

    expect(classifyAgentCompletion(result)).toBe("unverified");
  });

  it("does not promote unmaterialized fixer output", async () => {
    const result = await executeTimed(createFixerAgent());
    expect(classifyAgentCompletion(result)).toBe("unverified");
  });

  it("does not promote unmaterialized verifier output", async () => {
    const result = await executeTimed(createVerifierAgent() as ReturnType<typeof createFixerAgent>);
    expect(classifyAgentCompletion(result)).toBe("unverified");
  });

  it("does not promote unmaterialized synthesizer output", async () => {
    const result = await executeTimed(createSynthesizerAgent() as ReturnType<typeof createFixerAgent>);
    expect(classifyAgentCompletion(result)).toBe("unverified");
  });

  it("fails suspect reports and failing assertions even with verified git proof", () => {
    const result = {
      completion: "success",
      artifact: { type: "report", uri: "local://report/fake.json" },
      flags: ["suspect"],
      report: { failingAssertions: 3, ok: false },
    };

    expect(
      classifyAgentCompletion(result, { status: "verified" })
    ).toBe("failed");
  });

  it("requires trusted verified audit for success", () => {
    const result = {
      artifact: {
        type: "git-branch",
        uri: "local://branch/proof",
        commit: "b".repeat(40),
        files_changed: 1,
      },
    };

    expect(classifyAgentCompletion(result, { status: "verified" })).toBe(
      "success"
    );
    expect(classifyAgentCompletion(result, { status: "failed" })).toBe(
      "failed"
    );
  });
});
