import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ABOUT_COPY_PATH,
  ABOUT_OPERATING_CONTRACT_PATH,
  deriveAboutOperatingContract,
  loadAboutOperatingContract,
  validateAboutOperatingContract,
  validateAboutOperatingContractData,
} from "../../scripts/guard-about-operating-contract.mjs";
import { buildGoldenCaseReport } from "../../scripts/report-golden-cases.mjs";

const repoRoot = path.resolve(process.cwd());

describe("TradeScout About operating contract", () => {
  it("maps the canonical nine chapters and all 69 immutable display actions", () => {
    const result = validateAboutOperatingContract({ repoRoot });

    expect(result.chapters.map((chapter) => chapter.displayId)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
    ]);
    expect(result.chapters.map((chapter) => chapter.name)).toEqual([
      "Scout",
      "Direct Connect",
      "Business home",
      "Home & property",
      "Exchange",
      "Money",
      "Community",
      "CVS",
      "Every feature",
    ]);

    const expectedActionIds = [
      ...Array.from({ length: 18 }, (_, index) => `01.${String(index + 1).padStart(2, "0")}`),
      ...Array.from({ length: 18 }, (_, index) => `02.${String(index + 1).padStart(2, "0")}`),
      ...Array.from({ length: 9 }, (_, index) => `03.${String(index + 1).padStart(2, "0")}`),
      ...Array.from({ length: 24 }, (_, index) => `04.${String(index + 1).padStart(2, "0")}`),
    ];

    expect(result.actions).toHaveLength(69);
    expect(result.actions.map((action) => action.displayId)).toEqual(expectedActionIds);
    expect(new Set(result.actions.map((action) => action.displayId)).size).toBe(69);
  });

  it("keeps the JSX canonical and permits PROVEN only with production proof", () => {
    const { contract, source } = loadAboutOperatingContract(repoRoot);
    const derived = deriveAboutOperatingContract(source);

    expect(contract.canonicalCopy.path).toBe(ABOUT_COPY_PATH);
    expect(ABOUT_OPERATING_CONTRACT_PATH).toBe("config/tradescout-about-operating-contract.json");
    expect(derived.actions).toHaveLength(69);
    for (const action of contract.actions) {
      expect(Array.isArray(action.productionProof)).toBe(true);
      if (action.status === "PROVEN") {
        expect(action.productionProof.length).toBeGreaterThan(0);
      }
    }
  });

  it("defines the JW Stone and service-business golden journeys with honest stage states", () => {
    const { contract } = loadAboutOperatingContract(repoRoot);

    expect(
      contract.goldenJourneys.map((journey: { journeyId: string }) => journey.journeyId)
    ).toEqual(["jw-stone-catalog-inquiry", "service-business-lifecycle"]);

    for (const journey of contract.goldenJourneys) {
      expect(journey.stages.length).toBeGreaterThan(0);
      expect(new Set(journey.stages.map((stage: { stageId: string }) => stage.stageId)).size).toBe(
        journey.stages.length
      );
      for (const stage of journey.stages) {
        expect(["PROVEN", "PARTIAL", "BLOCKED"]).toContain(stage.status);
        expect(stage.evidenceRefs.length).toBeGreaterThan(0);
        expect(stage.actionIds.length).toBeGreaterThan(0);
        expect(Array.isArray(stage.productionProof)).toBe(true);
        if (stage.status === "PROVEN") {
          expect(stage.productionProof.length).toBeGreaterThan(0);
        }
        expect(stage.statusReason.trim().length).toBeGreaterThan(0);
        expect(stage.gap.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("fails closed when PROVEN lacks timestamped production proof", () => {
    const { contract, source } = loadAboutOperatingContract(repoRoot);
    const invalidContract = structuredClone(contract);
    invalidContract.actions[0].status = "PROVEN";
    invalidContract.actions[0].productionProof = [];

    expect(() =>
      validateAboutOperatingContractData({
        contract: invalidContract,
        source,
        repoRoot,
      })
    ).toThrow(/cannot be PROVEN without timestamped production proof/);
  });

  it("rejects malformed or unverifiable production proof", () => {
    const { contract, source } = loadAboutOperatingContract(repoRoot);
    const invalidActionProof = structuredClone(contract);
    invalidActionProof.actions[0].status = "PROVEN";
    invalidActionProof.actions[0].productionProof = [
      {
        environment: "production",
        verifiedAt: "2026-07-26",
        commit: "eedf5d757c8c994ae8f55f47492411333e72e32f",
        artifact: "made-up-proof.json",
      },
    ];

    expect(() =>
      validateAboutOperatingContractData({
        contract: invalidActionProof,
        source,
        repoRoot,
      })
    ).toThrow(/invalid production proof/);

    const invalidStageProof = structuredClone(contract);
    invalidStageProof.goldenJourneys[0].stages[0].productionProof = [{}];

    expect(() =>
      validateAboutOperatingContractData({
        contract: invalidStageProof,
        source,
        repoRoot,
      })
    ).toThrow(/Golden stage .* contains invalid production proof/);
  });

  it("allows a golden stage to graduate only with repository-backed production proof", () => {
    const { contract, source } = loadAboutOperatingContract(repoRoot);
    const promoted = structuredClone(contract);
    const verifiedAt = "2026-07-26T12:00:00.000Z";
    const commit = "eedf5d757c8c994ae8f55f47492411333e72e32f";
    const artifact = `test-results/about-production-proof-${process.pid}.json`;
    const artifactPath = path.resolve(repoRoot, artifact);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(
      artifactPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          kind: "tradescout-production-verification",
          environment: "production",
          verifiedAt,
          commit,
          subject: "golden-stage:jw-stone-catalog-inquiry/catalog-discovery",
          status: "PROVEN",
          checks: [{ name: "synthetic contract fixture", status: "PASS" }],
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    promoted.goldenJourneys[0].stages[0].status = "PROVEN";
    promoted.goldenJourneys[0].stages[0].productionProof = [
      {
        environment: "production",
        verifiedAt,
        commit,
        artifact,
      },
    ];

    try {
      expect(() =>
        validateAboutOperatingContractData({
          contract: promoted,
          source,
          repoRoot,
        })
      ).not.toThrow();
    } finally {
      fs.rmSync(artifactPath, { force: true });
    }
  });

  it("fails closed when canonical action copy or immutable IDs drift", () => {
    const { contract, source } = loadAboutOperatingContract(repoRoot);
    const invalidCopy = structuredClone(contract);
    invalidCopy.actions[0].action = "Different public action";

    expect(() =>
      validateAboutOperatingContractData({
        contract: invalidCopy,
        source,
        repoRoot,
      })
    ).toThrow(/Action 01\.01 copy drift/);

    const invalidId = structuredClone(contract);
    invalidId.actions[0].displayId = "01.99";

    expect(() =>
      validateAboutOperatingContractData({
        contract: invalidId,
        source,
        repoRoot,
      })
    ).toThrow(/immutable display IDs 01\.01–04\.24/);
  });

  it("keeps all registry evidence paths present in the repository", () => {
    const { contract } = loadAboutOperatingContract(repoRoot);

    for (const evidence of Object.values(contract.evidenceCatalog) as Array<{ path: string }>) {
      expect(fs.existsSync(path.resolve(repoRoot, evidence.path))).toBe(true);
    }
  });

  it("derives golden-case status and proof totals without hard-coding the current baseline", () => {
    const { contract } = loadAboutOperatingContract(repoRoot);
    const report = buildGoldenCaseReport(repoRoot);
    const stages = contract.goldenJourneys.flatMap(
      (journey: { stages: Array<{ status: string; productionProof: unknown[] }> }) =>
        journey.stages
    );
    const expectedCounts = stages.reduce(
      (counts: Record<string, number>, stage: { status: string }) => {
        counts[stage.status] += 1;
        return counts;
      },
      { PROVEN: 0, PARTIAL: 0, BLOCKED: 0 }
    );
    const expectedProofCount = stages.reduce(
      (count: number, stage: { productionProof: unknown[] }) =>
        count + stage.productionProof.length,
      0
    );
    const expectedStatus = expectedCounts.BLOCKED
      ? "BLOCKED"
      : expectedCounts.PARTIAL
        ? "PARTIAL"
        : "PROVEN";

    expect(report.journeys).toHaveLength(2);
    expect(report.status).toBe(expectedStatus);
    expect(report.counts).toEqual(expectedCounts);
    expect(report.productionProofCount).toBe(expectedProofCount);
  });
});
