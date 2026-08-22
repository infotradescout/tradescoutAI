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
    const searchDockSource = read("client/src/scout/ScoutSearchDock.tsx");
    const inputRowSource = read("client/src/scout/ScoutInputRow.tsx");
    const cssSource = read("client/src/index.css");
    const activeMarkup = scoutOsSource.slice(
      scoutOsSource.indexOf('data-testid="scout-current-task"')
    );
    const currentTaskIndex = activeMarkup.indexOf('data-testid="scout-current-task"');
    const auxiliaryRegionIndex = activeMarkup.indexOf('data-testid="scout-task-auxiliary-region"');
    const workRegionIndex = activeMarkup.indexOf('data-testid="scout-task-work-region"');
    const composerIndex = activeMarkup.indexOf('data-testid="scout-task-composer"');
    const auxiliaryRegionStart = activeMarkup.lastIndexOf("<section", auxiliaryRegionIndex);
    const auxiliaryRegionMarkup = activeMarkup.slice(auxiliaryRegionStart, workRegionIndex);
    const autoRouteSurfaceDefinition = scoutOsSource.slice(
      scoutOsSource.indexOf("const autoRouteAuxiliarySurface"),
      scoutOsSource.indexOf("const hasActiveTaskAuxiliaryContent")
    );
    const workRegionStart = activeMarkup.lastIndexOf("<section", workRegionIndex);
    const workRegionMarkup = activeMarkup.slice(workRegionStart, composerIndex);
    const userMessageReducerCase = stateSource
      .split('case "USER_MESSAGE"')[1]
      .split('case "SERVER_RESPONSE"')[0];

    expect(scoutOsSource).toContain("const showDiscoveryRail = false");
    expect(scoutOsSource).toContain('showDiscoveryRail ? "max-w-7xl" : "max-w-4xl"');
    expect(scoutOsSource).toContain("{showDiscoveryRail && (");
    expect(scoutOsSource).toContain("className={`w-full flex flex-1 flex-col min-h-0 relative ${");
    expect(scoutOsSource).toContain('isMobile || showDiscoveryRail ? "" : "max-w-4xl mx-auto"');
    expect(scoutOsSource).toContain('"calc(var(--scout-search-dock-h) + 1rem)"');
    expect(scoutOsSource).toContain('"calc(var(--scout-search-dock-h) + 1.25rem)"');
    expect(scoutOsSource).not.toContain("--scout-search-dock-height");
    expect(scoutOsSource).not.toContain("--global-nav-height");
    expect(scoutOsSource).not.toContain("+ 58px");
    expect(scoutOsSource).not.toContain("pendingContextCards={scoutContextCards}");
    expect(scoutOsSource).toContain('className="scout-input-bottom-pin order-3"');
    expect(scoutOsSource).toContain('data-testid="scout-current-task-title"');
    expect(scoutOsSource).toContain('data-testid="scout-latest-meaningful-state"');
    expect(scoutOsSource).toContain('data-testid="scout-primary-next-action"');
    expect(scoutOsSource).toContain('data-testid="scout-task-auxiliary-region"');
    expect(scoutOsSource).toContain('aria-label="Task guidance and controls"');
    expect(scoutOsSource).toContain('data-testid="scout-task-work-region"');
    expect(scoutOsSource).toContain('aria-labelledby="scout-task-work-region-title"');
    expect(scoutOsSource).toContain("Conversation and results");
    expect(scoutOsSource).toContain('data-testid="scout-task-composer"');
    expect(workRegionMarkup).toContain("<section");
    expect(workRegionMarkup).not.toContain("<details");
    expect(workRegionMarkup).not.toContain("hidden");
    expect(scoutOsSource).not.toContain("scrollOpenScoutTaskHistoryToLatest");
    expect(threadSource).toContain('scrollScoutThreadToLatest(node, "auto")');
    expect(threadSource).toContain("thread.scrollTo({ top: thread.scrollHeight, behavior })");
    expect(threadSource).not.toContain("scrollIntoView");
    expect(currentTaskIndex).toBe(0);
    expect(auxiliaryRegionIndex).toBeGreaterThan(currentTaskIndex);
    expect(workRegionIndex).toBeGreaterThan(auxiliaryRegionIndex);
    expect(workRegionIndex).toBeGreaterThan(currentTaskIndex);
    expect(composerIndex).toBeGreaterThan(workRegionIndex);
    expect(activeMarkup.slice(currentTaskIndex, workRegionIndex)).toContain(
      "hasActiveTaskAuxiliaryContent"
    );
    expect(auxiliaryRegionMarkup).toContain("launchContextSurface");
    expect(auxiliaryRegionMarkup).toContain("onboardingAuxiliarySurface");
    expect(auxiliaryRegionMarkup).toContain("objectiveAuxiliarySurface");
    expect(auxiliaryRegionMarkup).toContain("autoRouteAuxiliarySurface");
    expect(auxiliaryRegionMarkup).toContain("tabIndex={0}");
    expect(auxiliaryRegionMarkup.indexOf("autoRouteAuxiliarySurface")).toBeLessThan(
      auxiliaryRegionMarkup.indexOf("launchContextSurface")
    );
    expect(autoRouteSurfaceDefinition).toContain('data-testid="scout-priority-navigation"');
    expect(autoRouteSurfaceDefinition).toContain('? "Cancel"');
    expect(scoutOsSource).toContain("const AUTO_ROUTE_DELAY_MS = 1600");
    const startNewDefinition = scoutOsSource.slice(
      scoutOsSource.indexOf("const handleStartNewScoutThread"),
      scoutOsSource.indexOf("const handleSaveScoutThreadNow")
    );
    expect(startNewDefinition).toContain("cancelAutoRoute();");
    expect(startNewDefinition).not.toContain("setAutoRoutePending(null)");
    expect(startNewDefinition).toContain("[cancelAutoRoute, reset]");
    expect(
      scoutOsSource.slice(0, scoutOsSource.indexOf('data-testid="scout-current-task"'))
    ).toContain("{!hasUserMessages ? launchContextSurface : null}");
    expect(
      scoutOsSource.slice(0, scoutOsSource.indexOf('data-testid="scout-current-task"'))
    ).toContain("{!hasUserMessages ? onboardingAuxiliarySurface : null}");
    expect(activeMarkup).toContain("{!hasUserMessages ? objectiveAuxiliarySurface : null}");
    expect(activeMarkup).toContain("{!hasUserMessages ? autoRouteAuxiliarySurface : null}");
    expect(activeMarkup.match(/data-testid="scout-primary-next-action"/g)).toHaveLength(1);
    expect(activeMarkup.match(/data-testid="scout-task-auxiliary-region"/g)).toHaveLength(1);
    expect(activeMarkup.match(/data-testid="scout-task-composer"/g)).toHaveLength(1);
    expect(scoutOsSource).toContain("<ScoutHome");
    expect(scoutOsSource).toContain('placement="inline"');
    expect(scoutOsSource).not.toContain("Findings and recommended paths");
    expect(scoutOsSource).not.toContain("Choose Save to keep it for later.");
    expect(scoutOsSource).toContain("resolveLatestScoutTurnActionTruth");
    expect(scoutOsSource).toContain(
      "const primaryNextAction = latestTurnActionTruth.dominantAction"
    );
    expect(activeMarkup).toContain("currentTurnPrimaryAction={primaryNextAction}");
    expect(threadSource).toContain("source.primary === true");
    expect(threadSource).toContain("actionsMatch(action, currentTurnPrimaryAction)");
    expect(threadSource).toContain(
      "actionsMatch(frameChipToAction(chip), currentTurnPrimaryAction)"
    );
    expect(threadSource).toContain(
      "const hasActionChips = !hasResultContract && prioritizedActionChips.length > 0"
    );
    expect(threadSource).toContain("currentTurnPrimaryAction={currentTurnPrimaryAction}");
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
    expect(cssSource).toMatch(
      /\.scout-task-work-region\s*\{[^}]*display:\s*flex;[^}]*flex:\s*1 1 0;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s
    );
    expect(cssSource).toMatch(
      /\.scout-task-work-region__body\s*\{[^}]*flex:\s*1 1 0;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s
    );
    expect(cssSource).toMatch(
      /\.scout-task-work-region \.scout-thread\s*\{[^}]*overscroll-behavior:\s*contain;/s
    );
    expect(cssSource).toMatch(
      /\.scout-task-auxiliary-region\s*\{[^}]*flex:\s*0 1 auto;[^}]*min-height:\s*44px;[^}]*max-height:\s*min\(16rem,\s*28dvh\);[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s
    );
    expect(cssSource).toMatch(
      /\.scout-task-auxiliary-region > \.scout-task-auxiliary-region__priority\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*z-index:\s*2;/s
    );
    expect(cssSource).toMatch(
      /\.scout-active-workbench > \.scout-task-work-region\s*\{[^}]*min-height:\s*clamp\(6rem,\s*20dvh,\s*12rem\);/s
    );
    expect(cssSource).toMatch(
      /@media \(max-width: 640px\)[^{]*\{.*?\.scout-task-auxiliary-region\s*\{[^}]*max-height:\s*min\(9rem,\s*14dvh\);.*?\.scout-active-workbench > \.scout-task-work-region\s*\{[^}]*min-height:\s*clamp\(5\.5rem,\s*18dvh,\s*7rem\);/s
    );
    expect(cssSource).toMatch(/\.scout-command-bar__input\s*\{[^}]*max-height:\s*120px;/s);
    expect(cssSource).toMatch(
      /@media \(max-width: 640px\)\s*\{.*?\.scout-command-bar__input\s*\{[^}]*max-height:\s*72px;/s
    );
    expect(cssSource).toMatch(
      /@media \(min-width: 641px\) and \(max-height: 700px\)\s*\{.*?body\.ts-scout-active\s+\.scout-shell\.scout-shell--active-task\s+\.scout-search-dock-fixed\s+\.scout-command-bar__input\s*\{[^}]*max-height:\s*72px;[^}]*overflow-y:\s*auto;/s
    );
    expect(cssSource).toContain("#app-scroll-root:has(.scout-shell--active-task)");
    expect(cssSource).toMatch(
      /\.scout-shell\.scout-shell--active-task\s*\{[^}]*--scout-search-dock-min-h:\s*92px;[^}]*--scout-search-dock-h:\s*var\(--scout-search-dock-min-h\);/s
    );
    expect(cssSource).toMatch(
      /@media \(max-width: 640px\)[^{]*\{.*?\.scout-shell\.scout-shell--active-task\s*\{[^}]*--scout-search-dock-min-h:\s*96px;/s
    );
    expect(cssSource).toMatch(
      /\.scout-search-dock-fixed\s*\{[^}]*bottom:\s*var\(--bottom-nav-h, 62px\);[^}]*min-height:\s*var\(--scout-search-dock-min-h, 92px\);/s
    );
    expect(searchDockSource).toContain('dock?.closest<HTMLElement>(".scout-shell--active-task")');
    expect(searchDockSource).toContain("new ResizeObserver(publishRenderedHeight)");
    expect(searchDockSource).toContain("dock.getBoundingClientRect().height");
    expect(searchDockSource).toContain(
      "activeWorkspace.style.setProperty(reserveProperty, nextReserve)"
    );
    expect(searchDockSource).toContain("activeWorkspace.style.removeProperty(reserveProperty)");
    expect(inputRowSource).toContain("React.useLayoutEffect(() =>");
    expect(inputRowSource).toContain('textarea.style.removeProperty("height")');
    expect(inputRowSource).toContain("}, [value]);");
    expect(threadSource).toContain("isScoutThreadNearLatest(node)");
    expect(threadSource).toContain('node.addEventListener("scroll", rememberReaderPosition');
    expect(threadSource).toContain("if (!retainLatestOnResizeRef.current) return");
    expect(cssSource).not.toContain(
      "bottom: calc(var(--bottom-nav-h, 62px) + env(safe-area-inset-bottom, 0px))"
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
