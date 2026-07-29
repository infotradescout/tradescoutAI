import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { deriveDeterministicIntent } from "../server/services/scoutDeterministicIntent";
import { normalizeScoutRequest } from "../server/scout/scoutRequestNormalizer";
import { runScoutDecisionPipeline } from "../server/scout/scoutDecisionPipeline";
import { maybeHandleHomeProjectRouting } from "../server/scout/scoutHomeProjectRouting";
import {
  buildScoutResultContractV1,
  inferScoutResultIntentV1,
} from "../server/scout/scoutResultContractV1";
import { scoutFollowupReferencesPriorContext } from "../server/scout/scoutWorkingMemory";
import {
  buildScoutHybridIndex,
  createScoutHybridSearchIndex,
  DeterministicDenseEmbeddingProvider,
  type ScoutHybridSearchResult,
} from "../server/services/scoutHybridRetrievalService";
import {
  buildScoutBrainBenchmarkCases,
  buildScoutBrainBenchmarkCorpus,
  type ScoutBrainBenchmarkCase,
  type ScoutBrainIntent,
  type ScoutBenchmarkCorpusRecord,
} from "./lib/scout-brain-benchmark-fixture";

type PredictedIntent = ScoutBrainIntent | "unknown";
type BenchmarkAdapter = "legacy" | "hybrid-shadow";

type BenchmarkPrediction = {
  intent: PredictedIntent;
  rankedIds: string[];
  actionIds: string[];
  routes: string[];
  localityFilterPreserved: boolean;
  workingMemoryUsed: boolean;
  verifiedCompletion: boolean;
  resultContractFields: string[];
  decisionType: string;
  behaviorKey: string | null;
};

type CaseResult = {
  id: string;
  family: ScoutBrainBenchmarkCase["family"];
  query: string;
  expectedIntent: ScoutBrainIntent;
  predictedIntent: PredictedIntent;
  intentCorrect: boolean;
  expectedRelevantIds: string[];
  rankedIds: string[];
  recallAt10: number | null;
  ndcgAt5: number | null;
  localityCorrect: boolean | null;
  expectedActionId: string | null;
  actionIds: string[];
  workingMemoryRequired: boolean;
  workingMemoryPassed: boolean | null;
  verifiedCompletion: boolean | null;
  decisionType: string;
  behaviorKey: string | null;
  routes: string[];
  resultContractFields: string[];
};

const REQUIRED_RESULT_CONTRACT_FIELDS = [
  "intent",
  "ambiguity_options",
  "entities",
  "evidence",
  "answer",
  "allowed_actions",
  "working_memory_update",
] as const;

const ROOT = process.cwd();
const DEFAULT_SUBJECT_COMMIT = "d75401caca311552d4fd0108c8ae47aff2d7c010";

function getCliValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getHeadCommit(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
}

function mapLegacyDecisionToIntent(args: {
  decisionType: string;
  behaviorKey: string | null;
  deterministicIntent: string | null;
}): PredictedIntent {
  if (args.deterministicIntent) return "asset_action";

  if (
    args.behaviorKey === "home_project_routing" ||
    args.behaviorKey === "contractor_search_routing"
  ) {
    return "provider_search";
  }

  if (
    args.decisionType === "blocked" ||
    args.behaviorKey === "explicit_navigation" ||
    args.behaviorKey === "provider_routing" ||
    args.behaviorKey === "community_routing" ||
    args.behaviorKey === "marketplace_routing" ||
    args.behaviorKey === "support_routing"
  ) {
    return "asset_action";
  }

  return "unknown";
}

function legacyPrediction(testCase: ScoutBrainBenchmarkCase): BenchmarkPrediction {
  const normalized = normalizeScoutRequest({
    message: testCase.query,
    userId: "benchmark-user",
    isAuthenticated: true,
    countyCode: testCase.locality?.countyFips,
    stateCode: testCase.locality?.state,
    countyFips: testCase.locality?.countyFips,
    history: testCase.history,
    sessionId: "scout-brain-benchmark",
  });
  const decision = runScoutDecisionPipeline(normalized);
  const behaviorKey =
    typeof decision.behaviorKey === "string" && decision.behaviorKey
      ? decision.behaviorKey
      : null;
  const deterministicIntent = deriveDeterministicIntent(testCase.query);
  const intent = mapLegacyDecisionToIntent({
    decisionType: decision.type,
    behaviorKey,
    deterministicIntent,
  });

  const routes: string[] = [];
  if (behaviorKey === "explicit_navigation" && typeof decision.metadata?.route === "string") {
    routes.push(decision.metadata.route);
  }

  if (behaviorKey === "home_project_routing") {
    const homeRoute = maybeHandleHomeProjectRouting({
      message: testCase.query,
      countyCode: testCase.locality?.countyFips,
      stateCode: testCase.locality?.state,
    });
    if (homeRoute) {
      for (const action of homeRoute.actions) {
        if (action.to) routes.push(action.to);
      }
    }
  }

  const localityFilterPreserved = Boolean(
    testCase.locality &&
      routes.some((route) => {
        const hasCounty = route.includes(
          `county=${encodeURIComponent(testCase.locality!.countyFips)}`
        );
        const hasState = route.includes(`state=${encodeURIComponent(testCase.locality!.state)}`);
        return hasCounty && hasState;
      })
  );

  return {
    intent,
    rankedIds: [],
    actionIds: [],
    routes,
    localityFilterPreserved,
    workingMemoryUsed: false,
    verifiedCompletion: false,
    resultContractFields: [],
    decisionType: decision.type,
    behaviorKey,
  };
}

function buildConversationQuery(testCase: ScoutBrainBenchmarkCase): string {
  return [
    ...(testCase.history || [])
      .filter((message) => message.role === "user")
      .map((message) => message.content),
    testCase.query,
  ]
    .filter(Boolean)
    .join("\n");
}

function sameRanking(left: string[], right: string[]): boolean {
  return JSON.stringify(left.slice(0, 10)) === JSON.stringify(right.slice(0, 10));
}

async function buildHybridPredictions(args: {
  cases: ScoutBrainBenchmarkCase[];
  corpus: ScoutBenchmarkCorpusRecord[];
}): Promise<Map<string, BenchmarkPrediction>> {
  const embeddingProvider = new DeterministicDenseEmbeddingProvider();
  const artifact = await buildScoutHybridIndex({
    documents: args.corpus.map((record) => ({
      id: record.id,
      kind: record.kind,
      title: record.title,
      body: record.body,
      sourceUrl: record.sourceUrl,
      taxonomy: record.taxonomy,
      locality: {
        countyFips: record.locality.countyFips,
        state: record.locality.state,
      },
      authority: record.kind === "provider" ? "first_party" : "reviewed",
      updatedAt: "2026-07-29T00:00:00.000Z",
    })),
    embeddingProvider,
  });
  const index = createScoutHybridSearchIndex({ artifact, embeddingProvider });
  const corpusById = new Map(args.corpus.map((record) => [record.id, record]));

  const search = async (
    testCase: ScoutBrainBenchmarkCase,
    queryText: string,
    intent: PredictedIntent
  ): Promise<ScoutHybridSearchResult[]> => {
    if (intent !== "provider_search" && intent !== "code_query") return [];
    return index.search({
      text: queryText,
      kind: intent === "provider_search" ? "provider" : "knowledge",
      locality: testCase.locality
        ? {
            countyFips: testCase.locality.countyFips,
            state: testCase.locality.state,
          }
        : null,
      strictLocality: Boolean(testCase.locality),
      requireCountyMatch: Boolean(testCase.locality?.countyFips),
      asOf: "2026-07-29T00:00:00.000Z",
      limit: 10,
    });
  };

  const predictions = new Map<string, BenchmarkPrediction>();
  for (const testCase of args.cases) {
    const conversationQuery = buildConversationQuery(testCase);
    const intent = inferScoutResultIntentV1(conversationQuery).intent;
    const currentOnlyIntent = inferScoutResultIntentV1(testCase.query).intent;
    const ranked = await search(testCase, conversationQuery, intent);
    const currentOnlyRanked = testCase.history?.length
      ? await search(testCase, testCase.query, currentOnlyIntent)
      : ranked;
    const rankedIds = ranked.map((result) => result.id);
    const currentOnlyIds = currentOnlyRanked.map((result) => result.id);
    const resultContract = buildScoutResultContractV1({
      requestMessage: conversationQuery,
      source: {
        intent,
        entities: ranked.map((result) => ({
          id: result.id,
          type: result.kind,
          name: result.title,
          url: result.sourceUrl,
          match_reasons: [
            `BM25 ${result.bm25Score.toFixed(4)}`,
            `dense ${result.denseScore.toFixed(4)}`,
          ],
        })),
        evidence: ranked.map((result) => ({
          source_id: result.id,
          title: result.title,
          url: result.sourceUrl,
          match_reason: `Hybrid score ${result.score.toFixed(4)}`,
        })),
      },
      answer: ranked.length
        ? "Controlled benchmark retrieval returned grounded records."
        : "No controlled benchmark record was returned.",
      workingMemoryUpdate: {},
    });
    const localityFilterPreserved = Boolean(
      testCase.locality &&
        ranked.length > 0 &&
        ranked.every((result) => {
          const record = corpusById.get(result.id);
          return (
            record?.locality.countyFips === testCase.locality?.countyFips &&
            record?.locality.state === testCase.locality?.state
          );
        })
    );

    predictions.set(testCase.id, {
      intent: resultContract.intent,
      rankedIds,
      actionIds: resultContract.allowed_actions.map((action) => action.action_id),
      routes: [],
      localityFilterPreserved,
      workingMemoryUsed: Boolean(
        testCase.history?.length &&
          (currentOnlyIntent !== intent ||
            !sameRanking(currentOnlyIds, rankedIds) ||
            scoutFollowupReferencesPriorContext(testCase.query))
      ),
      verifiedCompletion: false,
      resultContractFields: Object.keys(resultContract),
      decisionType: "hybrid_shadow",
      behaviorKey: "server_owned_result_contract",
    });
  }
  return predictions;
}

function recallAtK(relevantIds: string[], rankedIds: string[], k: number): number | null {
  if (relevantIds.length === 0) return null;
  const relevant = new Set(relevantIds);
  const hits = rankedIds.slice(0, k).filter((id) => relevant.has(id)).length;
  return hits / relevant.size;
}

function ndcgAtK(relevantIds: string[], rankedIds: string[], k: number): number | null {
  if (relevantIds.length === 0) return null;
  const relevant = new Set(relevantIds);
  let dcg = 0;
  for (const [index, id] of rankedIds.slice(0, k).entries()) {
    if (relevant.has(id)) {
      dcg += 1 / Math.log2(index + 2);
    }
  }

  const idealHits = Math.min(relevant.size, k);
  let idcg = 0;
  for (let index = 0; index < idealHits; index += 1) {
    idcg += 1 / Math.log2(index + 2);
  }
  return idcg > 0 ? dcg / idcg : 0;
}

function mean(values: Array<number | null>): number | null {
  const measured = values.filter((value): value is number => typeof value === "number");
  if (measured.length === 0) return null;
  return measured.reduce((sum, value) => sum + value, 0) / measured.length;
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function roundMetric(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(4));
}

function evaluateCase(
  testCase: ScoutBrainBenchmarkCase,
  prediction: BenchmarkPrediction
): CaseResult {
  const recall = recallAtK(testCase.expectedRelevantIds, prediction.rankedIds, 10);
  const ndcg = ndcgAtK(testCase.expectedRelevantIds, prediction.rankedIds, 5);
  const hasRetrievalExpectation = testCase.expectedRelevantIds.length > 0;
  const workingMemoryRequired = Boolean(testCase.requiresWorkingMemory);
  const expectedAction = testCase.expectedActionId ?? null;

  return {
    id: testCase.id,
    family: testCase.family,
    query: testCase.query,
    expectedIntent: testCase.expectedIntent,
    predictedIntent: prediction.intent,
    intentCorrect: prediction.intent === testCase.expectedIntent,
    expectedRelevantIds: testCase.expectedRelevantIds,
    rankedIds: prediction.rankedIds,
    recallAt10: roundMetric(recall),
    ndcgAt5: roundMetric(ndcg),
    localityCorrect:
      hasRetrievalExpectation && testCase.locality
        ? prediction.localityFilterPreserved && prediction.rankedIds.length > 0
        : null,
    expectedActionId: expectedAction,
    actionIds: prediction.actionIds,
    workingMemoryRequired,
    workingMemoryPassed: workingMemoryRequired
      ? prediction.workingMemoryUsed &&
        prediction.intent === testCase.expectedIntent &&
        (hasRetrievalExpectation
          ? prediction.rankedIds.some((id) => testCase.expectedRelevantIds.includes(id))
          : expectedAction
            ? prediction.actionIds.includes(expectedAction)
            : true)
      : null,
    verifiedCompletion: expectedAction ? prediction.verifiedCompletion : null,
    decisionType: prediction.decisionType,
    behaviorKey: prediction.behaviorKey,
    routes: prediction.routes,
    resultContractFields: prediction.resultContractFields,
  };
}

function buildConfusionMatrix(results: CaseResult[]) {
  const labels: PredictedIntent[] = [
    "code_query",
    "provider_search",
    "asset_action",
    "unknown",
  ];
  const matrix: Record<string, Record<string, number>> = {};
  for (const expected of labels.slice(0, 3)) {
    matrix[expected] = {};
    for (const predicted of labels) matrix[expected][predicted] = 0;
  }
  for (const result of results) {
    matrix[result.expectedIntent][result.predictedIntent] += 1;
  }
  return { labels, matrix };
}

function formatPercent(value: number | null): string {
  return value === null ? "unmeasured" : `${(value * 100).toFixed(1)}%`;
}

function formatPercentagePointDelta(
  current: number | null,
  baseline: number | null
): string {
  if (current === null || baseline === null) return "unmeasured";
  const delta = (current - baseline) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pp`;
}

function writeMarkdown(args: {
  outputPath: string;
  adapter: BenchmarkAdapter;
  subjectCommit: string;
  executionHead: string;
  cases: ScoutBrainBenchmarkCase[];
  corpusCount: number;
  results: CaseResult[];
  metrics: Record<string, number | null>;
  baselineMetrics: Record<string, number | null> | null;
  confusion: ReturnType<typeof buildConfusionMatrix>;
}) {
  const lines: string[] = [];
  lines.push(
    args.adapter === "legacy"
      ? "# Scout Brain Baseline"
      : "# Scout Brain Hybrid Shadow Evaluation"
  );
  lines.push("");
  lines.push(`- Subject commit: \`${args.subjectCommit}\``);
  lines.push(`- Execution HEAD: \`${args.executionHead}\``);
  lines.push(`- Query count: ${args.cases.length}`);
  lines.push(`- Controlled corpus records: ${args.corpusCount}`);
  lines.push(
    args.adapter === "legacy"
      ? "- Adapter: legacy deterministic Scout decision pipeline"
      : "- Adapter: server-owned result contract with hybrid BM25 + dense shadow retrieval"
  );
  lines.push(
    args.adapter === "legacy"
      ? "- Scope: reproducible offline benchmark; no live provider, production database, or LLM calls"
      : "- Scope: reproducible offline shadow benchmark; controlled corpus and deterministic test embeddings; no live provider, production database, LLM, or user-facing cutover"
  );
  lines.push("");
  lines.push("## Required metrics");
  lines.push("");
  const metricRows: Array<[string, string]> = [
    ["Intent accuracy", "intentAccuracy"],
    ["Recall@10", "recallAt10"],
    ["NDCG@5", "ndcgAt5"],
    ["Locality correctness", "localityCorrectness"],
    ["Verified downstream task completion", "verifiedTaskCompletion"],
    ["Working-memory continuity", "workingMemoryContinuity"],
    ["Required result-contract field coverage", "resultContractCoverage"],
  ];
  if (args.adapter === "hybrid-shadow" && args.baselineMetrics) {
    lines.push("| Metric | d75401c baseline | Hybrid shadow | Change |");
    lines.push("| --- | ---: | ---: | ---: |");
    for (const [label, key] of metricRows) {
      const baseline = args.baselineMetrics[key] ?? null;
      const current = args.metrics[key] ?? null;
      lines.push(
        `| ${label} | ${formatPercent(baseline)} | ${formatPercent(current)} | ${formatPercentagePointDelta(current, baseline)} |`
      );
    }
  } else {
    lines.push("| Metric | Baseline |");
    lines.push("| --- | ---: |");
    for (const [label, key] of metricRows) {
      lines.push(`| ${label} | ${formatPercent(args.metrics[key] ?? null)} |`);
    }
  }
  lines.push("");
  lines.push("## Intent confusion matrix");
  lines.push("");
  lines.push("| Expected \\ Predicted | code_query | provider_search | asset_action | unknown |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const expected of ["code_query", "provider_search", "asset_action"] as const) {
    const row = args.confusion.matrix[expected];
    lines.push(
      `| ${expected} | ${row.code_query} | ${row.provider_search} | ${row.asset_action} | ${row.unknown} |`
    );
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push(
    args.adapter === "legacy"
      ? "- The legacy pipeline does not emit ranked entities or cited evidence through one result contract, so retrieval metrics and locality correctness cannot pass."
      : "- Shadow retrieval is evaluated without replacing the user-facing legacy answer path."
  );
  lines.push(
    "- A response or route is not counted as task completion. Completion requires a verified downstream state transition."
  );
  lines.push(
    args.adapter === "legacy"
      ? "- Memory cases require prior-turn context to affect the result; the legacy adapter records no working-memory use."
      : "- Retrieval follow-ups use prior-turn context. Asset-action follow-ups remain incomplete until a real approved mutation reaches a verified downstream state."
  );
  lines.push(
    "- Controlled corpus URLs are benchmark identifiers, not claims about live TradeScout pages."
  );
  lines.push("");
  lines.push("## Failed cases");
  lines.push("");
  const failed = args.results.filter(
    (result) =>
      !result.intentCorrect ||
      result.recallAt10 === 0 ||
      result.ndcgAt5 === 0 ||
      result.localityCorrect === false ||
      result.workingMemoryPassed === false ||
      result.verifiedCompletion === false
  );
  lines.push(`Failed at least one applicable metric: ${failed.length}/${args.results.length}`);
  lines.push("");
  for (const result of failed.slice(0, 30)) {
    lines.push(
      `- \`${result.id}\`: expected ${result.expectedIntent}, predicted ${result.predictedIntent}; decision=${result.decisionType}${result.behaviorKey ? `/${result.behaviorKey}` : ""}`
    );
  }
  if (failed.length > 30) {
    lines.push(`- … ${failed.length - 30} additional failures are recorded in the JSON artifact.`);
  }
  lines.push("");

  fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
  fs.writeFileSync(args.outputPath, `${lines.join("\n")}\n`, "utf8");
}

async function run() {
  const adapterValue = getCliValue("--adapter") || "legacy";
  if (adapterValue !== "legacy" && adapterValue !== "hybrid-shadow") {
    throw new Error(`Unsupported Scout Brain benchmark adapter: ${adapterValue}`);
  }
  const adapter: BenchmarkAdapter = adapterValue;
  const executionHead = getHeadCommit();
  const subjectCommit =
    getCliValue("--subject-commit") ??
    (adapter === "legacy" ? DEFAULT_SUBJECT_COMMIT : executionHead);
  const cases = buildScoutBrainBenchmarkCases();
  const corpus = buildScoutBrainBenchmarkCorpus();
  const hybridPredictions =
    adapter === "hybrid-shadow" ? await buildHybridPredictions({ cases, corpus }) : null;
  const results = cases.map((testCase) =>
    evaluateCase(
      testCase,
      hybridPredictions?.get(testCase.id) ?? legacyPrediction(testCase)
    )
  );

  const intentCorrect = results.filter((result) => result.intentCorrect).length;
  const localityMeasured = results.filter(
    (result) => typeof result.localityCorrect === "boolean"
  );
  const memoryMeasured = results.filter(
    (result) => typeof result.workingMemoryPassed === "boolean"
  );
  const completionMeasured = results.filter(
    (result) => typeof result.verifiedCompletion === "boolean"
  );
  const contractFieldHits = results.reduce(
    (total, result) =>
      total +
      REQUIRED_RESULT_CONTRACT_FIELDS.filter((field) =>
        result.resultContractFields.includes(field)
      ).length,
    0
  );

  const metrics = {
    intentAccuracy: roundMetric(percentage(intentCorrect, results.length)),
    recallAt10: roundMetric(mean(results.map((result) => result.recallAt10))),
    ndcgAt5: roundMetric(mean(results.map((result) => result.ndcgAt5))),
    localityCorrectness: roundMetric(
      percentage(
        localityMeasured.filter((result) => result.localityCorrect).length,
        localityMeasured.length
      )
    ),
    verifiedTaskCompletion: roundMetric(
      percentage(
        completionMeasured.filter((result) => result.verifiedCompletion).length,
        completionMeasured.length
      )
    ),
    workingMemoryContinuity: roundMetric(
      percentage(
        memoryMeasured.filter((result) => result.workingMemoryPassed).length,
        memoryMeasured.length
      )
    ),
    resultContractCoverage: roundMetric(
      percentage(
        contractFieldHits,
        REQUIRED_RESULT_CONTRACT_FIELDS.length * results.length
      )
    ),
  };
  const confusion = buildConfusionMatrix(results);
  const baselineArtifactPath = path.join(
    ROOT,
    "artifacts",
    "scout-brain",
    "scout-brain-baseline-d75401ca.json"
  );
  const baselineMetrics =
    adapter === "hybrid-shadow" && fs.existsSync(baselineArtifactPath)
      ? (JSON.parse(fs.readFileSync(baselineArtifactPath, "utf8")).metrics as Record<
          string,
          number | null
        >)
      : null;
  const metricDeltas = baselineMetrics
    ? Object.fromEntries(
        Object.entries(metrics).map(([key, value]) => [
          key,
          value === null || baselineMetrics[key] === null || baselineMetrics[key] === undefined
            ? null
            : roundMetric(value - Number(baselineMetrics[key])),
        ])
      )
    : null;

  const baseName = `scout-brain-${
    adapter === "legacy" ? "baseline" : "hybrid-shadow"
  }-${subjectCommit.slice(0, 8)}`;
  const outputDir = path.join(ROOT, "artifacts", "scout-brain");
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  const markdownPath = path.join(outputDir, `${baseName}.md`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        subjectCommit,
        executionHead,
        adapter:
          adapter === "legacy"
            ? "legacy_deterministic_pipeline"
            : "server_contract_hybrid_shadow",
        liveCallsMade: false,
        queryCount: cases.length,
        corpusRecordCount: corpus.length,
        requiredResultContractFields: REQUIRED_RESULT_CONTRACT_FIELDS,
        baselineMetrics,
        metrics,
        metricDeltas,
        confusion,
        results,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  writeMarkdown({
    outputPath: markdownPath,
    adapter,
    subjectCommit,
    executionHead,
    cases,
    corpusCount: corpus.length,
    results,
    metrics,
    baselineMetrics,
    confusion,
  });

  console.log(
    JSON.stringify(
      {
        adapter,
        subjectCommit,
        executionHead,
        queryCount: cases.length,
        corpusRecordCount: corpus.length,
        metrics,
        jsonPath: path.relative(ROOT, jsonPath),
        markdownPath: path.relative(ROOT, markdownPath),
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
