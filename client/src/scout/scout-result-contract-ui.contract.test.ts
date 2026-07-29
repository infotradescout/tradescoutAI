import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("server-owned Scout result UI", () => {
  it("carries the complete versioned result contract into message state", () => {
    const stateSource = read("client/src/scout/state.ts");
    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");

    expect(stateSource).toContain("resultContract?: ScoutResultContractV1");
    expect(scoutOsSource).toContain("contract_version: res.contract_version");
    expect(scoutOsSource).toContain("ambiguity_options: res.ambiguity_options");
    expect(scoutOsSource).toContain("allowed_actions: res.allowed_actions");
    expect(scoutOsSource).toContain("working_memory_update: res.working_memory_update");
  });

  it("renders ambiguity choices as real buttons linked to allowed action ids", () => {
    const threadSource = read("client/src/scout/ScoutThread.tsx");

    expect(threadSource).toContain('aria-label="Scout result actions"');
    expect(threadSource).toContain("source.action_id === option.action_id");
    expect(threadSource).toContain("Choose what you mean");
    expect(threadSource).toContain("onClick={() => onAction?.(action)}");
    expect(threadSource).toContain('type="button"');
  });

  it("does not reinterpret a server answer or simulate backend progress", () => {
    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");
    const threadSource = read("client/src/scout/ScoutThread.tsx");
    const apiSource = read("client/src/scout/api.ts");

    expect(scoutOsSource).not.toContain("sortScoutInfoDump");
    expect(scoutOsSource).not.toContain("inferScoutIntentDetails");
    expect(scoutOsSource).not.toContain("resolveSyncIntent");
    expect(scoutOsSource).not.toContain("UnifiedScoutRouterClient");
    expect(threadSource).not.toContain("ScoutResultActionCard");
    expect(threadSource).not.toContain("classifyScoutResultIntent");
    expect(threadSource).not.toContain("AssistantStreamedText");
    expect(threadSource).not.toContain("Math.random()");
    expect(apiSource).not.toContain("inferModeFromMessageAndRoles");
  });

  it("shows contract evidence and never labels every answer as local", () => {
    const threadSource = read("client/src/scout/ScoutThread.tsx");
    const provenanceSource = read("client/src/scout/provenance.ts");

    expect(threadSource).toContain("Boolean(msg.resultContract)");
    expect(threadSource).not.toContain(">Local results<");
    expect(provenanceSource).toContain("...(response.evidence || [])");
  });
});
