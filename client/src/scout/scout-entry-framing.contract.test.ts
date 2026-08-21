import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("Scout entry framing contracts", () => {
  it("header frames Scout as a Search + Control surface", () => {
    const source = read("client/src/scout/ScoutHeader.tsx");

    expect(source).toContain("Search local options and choose the next step.");
    expect(source).toContain("Review local activity, request context, and what to check");
    expect(source).toContain("request context");
    expect(source).toContain("Search local businesses");
    expect(source).toContain("Review next step");
    expect(source).toContain("Check prices");
    expect(source).toContain("Local results");
    expect(source).toContain("Start a material run");
    expect(source).toContain("Open messages");
    expect(source).toContain("Send a material list or supplier link to turn it into a Supply Run.");
    expect(source).not.toContain("What do you need help with today?");
    expect(source).not.toContain("Open Scout");
  });

  it("input row and quick-start surfaces use plain language", () => {
    const inputSource = read("client/src/scout/ScoutInputRow.tsx");
    const promptsSource = read("client/src/scout/scoutQuickStartPrompts.ts");

    expect(inputSource).toContain("Describe a project, permit question, estimate, or decision.");
    expect(inputSource).toContain("Search");
    expect(inputSource).toContain("Compare");
    expect(inputSource).toContain("Choose");
    expect(inputSource).toContain("Start search");
    expect(inputSource).not.toContain("Send message");
    expect(inputSource).not.toContain("Your area:");
    expect(inputSource).not.toContain("Use current location");
    expect(promptsSource).toContain("Continue my open work");
    expect(promptsSource).toContain("Plan my project");
    expect(promptsSource).toContain("Check codes and permits");
    expect(promptsSource).toContain("Build a realistic estimate");
    expect(promptsSource).toContain("Compare a quote");
    expect(promptsSource).toContain("Find the right professional");
  });

  it("keeps the capability map in the full Scout experience while home stays compact", () => {
    const homeSource = read("client/src/scout/ScoutHome.tsx");
    const experienceSource = read("client/src/scout/scoutExperience.ts");
    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");

    expect(homeSource).toContain("understand codes and permits");
    expect(homeSource).toContain("price the work");
    expect(homeSource).toContain("compare options");
    expect(homeSource).toContain("You review every next step.");
    expect(homeSource).toContain("<ScoutControlSnapshot");
    expect(homeSource).not.toContain("SCOUT_CAPABILITY_COPY");
    expect(experienceSource).toContain("Plan work");
    expect(experienceSource).toContain("Collect the right details");
    expect(experienceSource).toContain("Find local help");
    expect(experienceSource).toContain("Materials");
    expect(experienceSource).toContain("Prices and trends");
    expect(experienceSource).toContain("Exchange");
    expect(experienceSource).toContain("HomeScout");
    expect(experienceSource).toContain("Community Vault");
    expect(experienceSource).toContain("Finance tools");
    expect(experienceSource).toContain("Compare options");
    expect(experienceSource).toContain("Trust checks");
    expect(experienceSource).toContain("Saved conversations");
    expect(experienceSource).toContain("Community activity");
    expect(experienceSource).toContain(
      "I can send a material list or supplier link and Scout will turn it into a Supply Run draft."
    );
    expect(experienceSource).toContain("Full Scout view");
    expect(experienceSource).toContain("Materials and local options");
    expect(experienceSource).toContain("Price and trend checks");
    expect(experienceSource).toContain("Exchange options");
    expect(experienceSource).toContain("HomeScout and Home Vault");
    expect(experienceSource).toContain("Community Vault context");
    expect(experienceSource).toContain("Finance tools and bookkeeping");
    expect(experienceSource).toContain("/homescout-listings");
    expect(experienceSource).toContain("/foundation");
    expect(experienceSource).toContain("/finances/records");
    expect(experienceSource).toContain("bookkeeping system still needs rebuild work");
    expect(experienceSource).toContain("supplierUrl=");
    expect(experienceSource).toContain("Supplier page read");
    expect(experienceSource).toContain("Supplier page needs review");
    expect(experienceSource).toContain("/finances/materials");
    expect(experienceSource).toContain("Review before anything is sent");
    expect(experienceSource).toContain("Right details only");
    expect(experienceSource).toContain("Exchange activity");
    expect(experienceSource).toContain("Verified local help");
    expect(experienceSource).toContain("Local trend signal");
    expect(experienceSource).toContain("priceSignals");
    expect(experienceSource).toContain("opportunityMoves");
    expect(experienceSource).toContain("Opportunity Radar");
    expect(experienceSource).toContain("sourceBackedOpportunityItems");
    expect(experienceSource).toContain("formatPriceSignalFreshness");
    expect(experienceSource).toContain("formatPriceSignalSource");
    expect(experienceSource).toContain("priceSignalEvidenceSources");
    expect(experienceSource).toContain("Snapshot freshness unavailable");
    expect(homeSource).not.toContain("OpportunityMoveItem");
    expect(homeSource).not.toContain("formatPriceSignalFreshness");
    expect(homeSource).not.toContain("formatPriceSignalSource");
    expect(scoutOsSource).toContain("priceSignals: Array.isArray(data?.priceSignals)");
    expect(scoutOsSource).toContain("opportunityMoves: Array.isArray(data?.opportunityMoves)");
    expect(scoutOsSource).not.toContain("sourceSignals: scoutSourceSignalsQuery.data");
    expect(scoutOsSource).not.toContain("priceSignalEvidenceSources");
    expect(scoutOsSource).toContain("buildScoutProvenance(res)");
    expect(experienceSource).not.toContain("Scout Vault");
    expect(experienceSource).not.toContain("LISA");
  });

  it("documents competitive patterns without importing bad marketplace incentives", () => {
    const matrixSource = read("docs/audits/SCOUT_2_CATCHUP_MATRIX.md");
    const routeSource = read("server/routes/scout.ts");
    const polishSource = read("server/scout/scoutLaunchResponsePolish.ts");

    expect(matrixSource).toContain("Competitive Adoption Map");
    expect(matrixSource).toContain(
      "copy proven interaction patterns, not competitor business models"
    );
    expect(matrixSource).toContain("No lead selling");
    expect(routeSource).toContain("Like Thumbtack");
    expect(routeSource).toContain("Like Yelp");
    expect(routeSource).toContain("Like Google Local Services");
    expect(routeSource).toContain("Like Houzz");
    expect(routeSource).toContain("never imply Scout already booked");
    expect(polishSource).toContain("approval_boundary_added");
    expect(polishSource).toContain("competitive_pattern_guard");
    expect(polishSource).toContain(
      "nothing is booked, ordered, paid, messaged, posted, quoted, or invoiced"
    );
  });

  it("Scout home snapshot exposes precomputed county price signals only from county_metrics", () => {
    const routeSource = read("server/routes/scout-home-snapshot.ts");

    expect(routeSource).toContain("interface PriceSignal");
    expect(routeSource).toContain("interface OpportunityMove");
    expect(routeSource).toContain("getCountyPriceSignals");
    expect(routeSource).toContain("getCountyOpportunityMoves");
    expect(routeSource).toContain(".from(countyMetrics)");
    expect(routeSource).toContain("homescout_median_price");
    expect(routeSource).toContain("tradedeals_claimed_30d");
    expect(routeSource).toContain("completed_jobs_30d");
    expect(routeSource).toContain("completed_job_median_receipt_usd_30d");
    expect(routeSource).toContain("Completed job median receipt");
    expect(routeSource).toContain("updatedAt: countyMetrics.updatedAt");
    expect(routeSource).toContain("sourceLabel");
    expect(routeSource).toContain("sourceKind");
    expect(routeSource).toContain("confidence");
    expect(routeSource).toContain("First-party completed-job receipts");
    expect(routeSource).toContain("priceSignals");
    expect(routeSource).toContain("opportunityMoves");
    expect(routeSource).toContain("sourceMetricKeys");
    expect(routeSource).toContain("completed-job-demand");
    expect(routeSource).toContain("tradedeals-fast-win");
    expect(routeSource).toContain("community-partnership-window");
    expect(routeSource).not.toContain("pricingData");
    expect(routeSource).not.toContain("from(documents)");
    expect(routeSource).not.toContain("job_id");
    expect(routeSource).not.toContain("completed first-party job snapshots");
  });

  it("completed-job price snapshots are registered and scheduled as county metrics", () => {
    const metricRegistry = read("server/services/metricRegistry.ts");
    const snapshotJob = read("server/services/completedJobPriceSnapshotJob.ts");
    const scheduler = read("server/services/crawlerScheduler.ts");
    const packageJson = read("package.json");
    const runbook = read("docs/runbooks/completed-job-price-snapshots.md");

    expect(metricRegistry).toContain("COMPLETED_JOBS_30D");
    expect(metricRegistry).toContain("COMPLETED_JOB_MEDIAN_RECEIPT_USD_30D");
    expect(snapshotJob).toContain("runCompletedJobPriceSnapshotJob");
    expect(snapshotJob).toContain("FROM documents d");
    expect(snapshotJob).toContain("INNER JOIN users u ON u.id = d.created_by");
    expect(snapshotJob).toContain("writeMetricsBatch");
    expect(snapshotJob).toContain("MetricKey.COMPLETED_JOBS_30D");
    expect(snapshotJob).toContain("MetricKey.COMPLETED_JOB_MEDIAN_RECEIPT_USD_30D");
    expect(scheduler).toContain("runCompletedJobPriceSnapshotJob");
    expect(scheduler).toContain("completed_job_price_snapshots");
    expect(packageJson).toContain("snapshot:completed-job-prices");
    expect(runbook).toContain("Do not derive completed-job pricing directly from `documents`");
  });

  it("saved Scout conversation labels refresh from owned summary endpoints without changing storage shape", () => {
    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");
    const routeSource = read("server/routes.ts");

    expect(scoutOsSource).toContain("metadata: {");
    expect(scoutOsSource).toContain("relatedLabel: thread.relatedLabel");
    expect(scoutOsSource).toContain("relatedTo: thread.relatedTo");
    expect(routeSource).toContain("refreshScoutConversationRelatedLabels");
    expect(routeSource).toContain("loadScoutConversationRelatedLabels");
    expect(routeSource).toContain("scoutConversationSurfaceFilter");
    expect(routeSource).toContain("scoutConversationSurfaceWhere");
    expect(routeSource).toContain("req.query.surface");
    expect(routeSource).toContain("userHomes.ownerUserId");
    expect(routeSource).toContain("userVehicles.ownerUserId");
    expect(routeSource).toContain("commercialProjects.createdByUserId");
    expect(routeSource).toContain("homeProjects.ownerUserId");
    expect(routeSource).toContain("homeProjectSavedConversationLabel");
    expect(routeSource).toContain("FROM accounting_clients");
    expect(routeSource).toContain("relatedLabelRefreshedAt");
  });

  it("Scout 2 catch-up matrix keeps every showcase claim tied to a real state", () => {
    const matrixSource = read("docs/audits/SCOUT_2_CATCHUP_MATRIX.md");
    const featureMatrix = matrixSource
      .split("## Feature Matrix")[1]
      .split("## Competitive Adoption Map")[0];
    const rows = featureMatrix
      .split("\n")
      .filter((line) => line.startsWith("| ") && !line.includes("---"))
      .slice(1);

    expect(rows.length).toBeGreaterThanOrEqual(10);

    for (const row of rows) {
      const cells = row
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);

      expect(cells).toHaveLength(4);
      expect(cells[0]).not.toMatch(/\btbd\b|\bunknown\b/i);
      expect(cells[1]).toMatch(/\b(enforced|partial|policy target|internal only)\b/i);
      expect(cells[2]).not.toMatch(/\btbd\b|\bnone\b|\bunknown\b/i);
      expect(cells[3]).not.toMatch(/\btbd\b|\bunknown\b/i);
    }
  });

  it("thread and quick-start actions avoid internal controller framing", () => {
    const threadSource = read("client/src/scout/ScoutThread.tsx");
    const tilesSource = read("client/src/scout/scoutActionTiles.ts");

    expect(threadSource).toContain("Why this helps");
    expect(threadSource).toContain("Next steps");
    expect(threadSource).toContain("Keep going");
    expect(threadSource).toContain("Here are the best next steps");
    expect(threadSource).toContain("Best next step");
    expect(threadSource).toContain("AssistantMessageBubble");
    expect(threadSource).not.toContain("Controller actions");
    expect(threadSource).not.toContain("Top Recommendation");
    expect(tilesSource).toContain('label: "Create a local request"');
    expect(tilesSource).toContain('label: "Find local help"');
    expect(tilesSource).toContain('label: "Browse Exchange"');
  });

  it("active Scout conversations keep one resumable task loop in the first usable view", () => {
    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");
    const threadSource = read("client/src/scout/ScoutThread.tsx");
    const actionTruthSource = read("client/src/scout/actionValidation.ts");
    const stateSource = read("client/src/scout/state.ts");
    const cssSource = read("client/src/index.css");
    const activeMarkup = scoutOsSource.slice(
      scoutOsSource.indexOf('data-testid="scout-current-task"')
    );
    const currentTaskIndex = activeMarkup.indexOf('data-testid="scout-current-task"');
    const historyIndex = activeMarkup.indexOf('data-testid="scout-task-history"');
    const composerIndex = activeMarkup.indexOf('data-testid="scout-task-composer"');
    const userMessageReducerCase = stateSource
      .split('case "USER_MESSAGE"')[1]
      .split('case "SERVER_RESPONSE"')[0];

    expect(scoutOsSource).toContain("const showDiscoveryRail = false");
    expect(scoutOsSource).toContain('showDiscoveryRail ? "max-w-7xl" : "max-w-4xl"');
    expect(scoutOsSource).toContain("{showDiscoveryRail && (");
    expect(scoutOsSource).not.toContain("pendingContextCards={scoutContextCards}");
    expect(scoutOsSource).toContain('className="scout-input-bottom-pin order-3"');
    expect(scoutOsSource).toContain('data-testid="scout-current-task-title"');
    expect(scoutOsSource).toContain('data-testid="scout-latest-meaningful-state"');
    expect(scoutOsSource).toContain('data-testid="scout-primary-next-action"');
    expect(scoutOsSource).toContain('data-testid="scout-task-history"');
    expect(scoutOsSource).toContain('data-testid="scout-task-composer"');
    expect(scoutOsSource).toContain("<details");
    expect(scoutOsSource).toContain("scrollOpenScoutTaskHistoryToLatest(event.currentTarget)");
    expect(threadSource).toContain("scheduleFrame(() =>");
    expect(threadSource).toContain('querySelector<HTMLElement>(".scout-thread")');
    expect(threadSource).toContain(
      'thread.scrollTo({ top: thread.scrollHeight, behavior: "auto" })'
    );
    expect(currentTaskIndex).toBe(0);
    expect(historyIndex).toBeGreaterThan(currentTaskIndex);
    expect(composerIndex).toBeGreaterThan(historyIndex);
    expect(scoutOsSource).not.toContain("Findings and recommended paths");
    expect(scoutOsSource).not.toContain("Choose Save to keep it for later.");
    expect(scoutOsSource).toContain("resolveLatestScoutTurnActionTruth");
    expect(scoutOsSource).toContain(
      "const primaryNextAction = latestTurnActionTruth.dominantAction"
    );
    expect(scoutOsSource).not.toContain("controllerActions[0]");
    expect(userMessageReducerCase).toMatch(/lastActions:\s*\[\]/);
    expect(actionTruthSource).toContain('resultContract?.contract_version === "scout_result.v1"');
    expect(actionTruthSource).toContain("newestTurnIndex <= newestUserIndex");
    expect(actionTruthSource).toContain("allowedActions.flatMap");
    expect(actionTruthSource).toContain("resultContract.ambiguity_options.length > 0");
    expect(actionTruthSource).toContain("primaryActions.length === 1");
    expect(actionTruthSource).toContain("validateActions(actions)");
    expect(actionTruthSource).toContain('action.type === "NOOP"');
    expect(threadSource).toContain("scout-thread--task-loop");
    expect(cssSource).toMatch(
      /\.scout-thread--task-loop\s*>\s*\[data-scout-message-id\][^{]*\{[^}]*width:\s*min\(100%,\s*78ch\);/s
    );
    expect(cssSource).toMatch(
      /\.scout-thread--task-loop\s+\.scout-user-bubble\s*\{[^}]*align-items:\s*flex-start;/s
    );
    expect(scoutOsSource).toContain("Server-provided actions appear with each answer");
    expect(scoutOsSource).toContain("Search saved conversations");
    expect(scoutOsSource).toContain("SAVED_SCOUT_SURFACE_FILTERS");
    expect(scoutOsSource).toContain("savedScoutSurfaceFilter");
    expect(scoutOsSource).toContain("savedConversationQueryUrl");
    expect(scoutOsSource).toContain('params.set("surface", surface)');
    expect(scoutOsSource).toContain("Related to");
    expect(scoutOsSource).toContain("Open related view");
    expect(scoutOsSource).toContain("relatedPath");
    expect(scoutOsSource).toContain("relatedFromAction");
    expect(scoutOsSource).toContain("cluster.primaryAction");
    expect(scoutOsSource).toContain("...(Array.isArray(cluster.actions) ? cluster.actions : [])");
    expect(scoutOsSource).toContain("projectId");
    expect(scoutOsSource).toContain('surface: "home_project"');
    expect(scoutOsSource).toContain("contactId");
    expect(scoutOsSource).toContain("data.relatedTo");
    expect(scoutOsSource).toContain("projectLabelFromPayload");
    expect(scoutOsSource).toContain("homeLabelFromPayload");
    expect(scoutOsSource).toContain("vehicleLabelFromPayload");
    expect(scoutOsSource).toContain("clientLabelFromPayload");
    expect(scoutOsSource).toContain("/homes?homeId=");
    expect(scoutOsSource).toContain("&projectId=");
    expect(scoutOsSource).toContain("/vehicles?vehicleId=");
    expect(scoutOsSource).toContain("countyFips");
    expect(scoutOsSource).toContain("savedConversationQueryUrl");
    expect(scoutOsSource).toContain("resultContract:");
    expect(scoutOsSource).toContain("allowed_actions: res.allowed_actions");
  });

  it("preserves explicit context when classic pages open Scout", () => {
    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");
    const inputSource = read("client/src/scout/ScoutInputRow.tsx");
    const apiSource = read("client/src/scout/api.ts");
    const serverSource = read("server/routes/scout.ts");

    expect(scoutOsSource).toContain("readScoutBrowserLocation");
    expect(scoutOsSource).toContain("parseScoutLaunchLocation");
    expect(scoutOsSource).toContain("launchContext: scoutLaunch.context || undefined");
    expect(scoutOsSource).toContain("forcedPrefill={scoutLaunch.prompt}");
    expect(scoutOsSource).toContain("<ScoutLaunchContextCard");
    expect(inputSource).toContain("if (forcedPrefill)");
    expect(inputSource).toContain("setValue(forcedPrefill)");
    expect(apiSource).toContain("launchContext: options.launchContext");
    expect(serverSource).toContain("CLASSIC VIEW CONTEXT");
    expect(serverSource).toContain("Visibility still does not grant contact");
    expect(serverSource).toContain("Intent -> Decision Card -> Contact");
  });

  it("saved Scout related links can reopen stable home and vehicle records", () => {
    const homesSource = read("client/src/pages/homes.tsx");
    const vehiclesSource = read("client/src/pages/vehicles.tsx");

    expect(homesSource).toContain("initialHomeIdFromUrl");
    expect(homesSource).toContain('get("homeId")');
    expect(homesSource).toContain("initialProjectIdFromUrl");
    expect(homesSource).toContain('get("projectId")');
    expect(homesSource).toContain("data-project-id");
    expect(vehiclesSource).toContain("initialVehicleIdFromUrl");
    expect(vehiclesSource).toContain('get("vehicleId")');
  });

  it("Scout shell keeps the composer visible without ambient background bleed", () => {
    const cssSource = read("client/src/index.css");

    expect(cssSource).toContain(".scout-input-bottom-pin");
    expect(cssSource).toContain("position: sticky");
    expect(cssSource).toContain("bottom: 0");
    expect(cssSource).toContain("z-index: 30");
    expect(cssSource).toContain("overflow: clip !important");
    expect(cssSource).toContain(".scout-section-label");
    expect(cssSource).toContain(".scout-section-label__icon");
  });

  it("normal user Scout copy hides internal system words", () => {
    const extractQuotedText = (source: string) =>
      Array.from(source.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g), (match) => match[2]).join("\n");

    const visibleCopySources = [
      "client/src/scout/ScoutHeader.tsx",
      "client/src/scout/ScoutInputRow.tsx",
      "client/src/scout/ScoutThread.tsx",
      "client/src/scout/ScoutDirectConnectPanel.tsx",
      "client/src/scout/scoutExperience.ts",
    ]
      .map(read)
      .map(extractQuotedText)
      .join("\n");

    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");
    const threadSource = read("client/src/scout/ScoutThread.tsx");
    const scoutOs = extractQuotedText(
      scoutOsSource
        .split("\n")
        .filter((line) => {
          const internalLine =
            line.includes("type:") ||
            line.includes("action.type") ||
            line.includes("payload") ||
            line.includes("metadata") ||
            line.includes("AUTO_ROUTE") ||
            line.includes("routingDecisionCard") ||
            line.includes("syncResult.kind") ||
            line.includes("behaviorKey") ||
            line.includes("route:") ||
            line.includes("const [routing");
          return !internalLine;
        })
        .join("\n")
    );

    const normalUserCopy = `${visibleCopySources}\n${scoutOs}`.toLowerCase();
    const banned = [
      /\broute\b/,
      /\brouting\b/,
      /where scout looks/,
      /scout sorted your search/,
      /likely type/,
      /timing normal/,
      /timing: normal/,
      /tradescout search/,
      /\bsaved request\b/,
      /\bvalidator\b/,
      /call_tool/,
      /\bworkspace\b/,
      /no-op/,
    ];

    for (const term of banned) {
      expect(normalUserCopy).not.toMatch(term);
    }

    expect(scoutOsSource).toContain("Search controls");
    expect(scoutOsSource).toContain("Results + controls");
    expect(threadSource).not.toContain("Local results");
    expect(threadSource).not.toContain("Request context");
    expect(threadSource).not.toContain("Community-Powered");
    expect(threadSource).toContain("Choose what you mean");
    expect(threadSource).toContain("Available actions");
  });
});
