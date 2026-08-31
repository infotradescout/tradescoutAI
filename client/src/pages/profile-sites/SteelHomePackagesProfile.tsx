import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { STEEL_HOME_PACKAGES_PROFILE_IDENTITY as identity } from "@shared/steelHomePackagesProfile";
import {
  buildSteelHomeBuilderPath,
  resolveSteelHomeBuilderPathname,
} from "@shared/steelHomeBuilderRoutes";
import SteelHomeBuilderDirectory, {
  STEEL_HOME_BUILDERS,
  plannerFromHash,
  plannerLauncherId,
  plannerPanelId,
  type SteelHomePlanner,
} from "./steel-home-project-tools/SteelHomeBuilderDirectory";
import SteelHomePlannerRequest, {
  type SteelHomeRequestSelection,
} from "./steel-home-project-tools/SteelHomePlannerRequest";
import {
  createEmptySteelHomeProjectDraft,
  loadSteelHomeProjectDraft,
  reconcileSteelHomeProjectDraft,
  saveSteelHomeProjectDraft,
  type SteelHomeProjectDraft,
} from "./steel-home-project-tools/projectModel";

const BuildingDesigner = lazy(() => import("./steel-home-project-tools/BuildingDesigner"));
const CabinetDesigner = lazy(() => import("./steel-home-project-tools/CabinetDesigner"));
const CountertopDesigner = lazy(() => import("./steel-home-project-tools/CountertopDesigner"));

function PlannerBodyBoundary({
  children,
  plannerTitle,
}: {
  children: ReactNode;
  plannerTitle: string;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="grid min-h-[50vh] place-items-center bg-[#f5f1e8] p-8 text-center text-[#18312f]"
          data-testid="steel-home-planner-loading"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a94f2e]">
              Steel Home Planning Tools
            </p>
            <p className="mt-3 font-editorial text-2xl font-semibold">Loading {plannerTitle}…</p>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

type Props = {
  requestHref: string;
  laborRequestHref: string;
  platformBaseHref?: string;
  initialBuilder?: SteelHomePlanner | null;
  onNavigateBuilder?: (builder: SteelHomePlanner | null) => void;
};

function currentPlanner(): SteelHomePlanner | null {
  if (typeof window === "undefined") return null;
  return (
    resolveSteelHomeBuilderPathname(window.location.pathname) ||
    plannerFromHash(window.location.hash)
  );
}

type BuilderRequestDetails = Pick<
  SteelHomeProjectDraft,
  "location" | "stateCode" | "countyFips" | "countyName" | "timing" | "projectRole"
>;

type BuilderRequestDetailsByBuilder = Record<SteelHomePlanner, BuilderRequestDetails>;

const BUILDER_REQUEST_DETAILS_STORAGE_KEY = "tradescout:steel-home-builders:request-details:v1";

function requestDetailsFromDraft(draft: SteelHomeProjectDraft): BuilderRequestDetails {
  return {
    location: draft.location,
    stateCode: draft.stateCode,
    countyFips: draft.countyFips,
    countyName: draft.countyName,
    timing: draft.timing,
    projectRole: draft.projectRole,
  };
}

function createBuilderRequestDetails(
  seedDraft: SteelHomeProjectDraft = createEmptySteelHomeProjectDraft()
): BuilderRequestDetailsByBuilder {
  const seed = requestDetailsFromDraft(seedDraft);
  return {
    countertops: { ...seed },
    cabinets: { ...seed },
    building: { ...seed },
  };
}

function loadBuilderRequestDetails(
  storage: Storage | null,
  legacyDraft: SteelHomeProjectDraft
): BuilderRequestDetailsByBuilder {
  const empty = createBuilderRequestDetails();
  if (!storage) return empty;
  try {
    const raw = storage.getItem(BUILDER_REQUEST_DETAILS_STORAGE_KEY);
    if (!raw) return createBuilderRequestDetails(legacyDraft);
    const parsed = JSON.parse(raw) as Partial<BuilderRequestDetailsByBuilder>;
    return Object.fromEntries(
      STEEL_HOME_BUILDERS.map((builder) => {
        const reconciled = reconcileSteelHomeProjectDraft({
          ...createEmptySteelHomeProjectDraft(),
          ...(parsed[builder.key] || {}),
        });
        return [builder.key, requestDetailsFromDraft(reconciled)];
      })
    ) as BuilderRequestDetailsByBuilder;
  } catch {
    return empty;
  }
}

function saveBuilderRequestDetails(
  storage: Storage | null,
  details: BuilderRequestDetailsByBuilder
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(BUILDER_REQUEST_DETAILS_STORAGE_KEY, JSON.stringify(details));
    return true;
  } catch {
    return false;
  }
}

export default function SteelHomePackagesProfile({
  requestHref,
  laborRequestHref,
  initialBuilder,
  onNavigateBuilder,
}: Props) {
  const [draft, setDraft] = useState<SteelHomeProjectDraft>(() =>
    createEmptySteelHomeProjectDraft()
  );
  const [storageReady, setStorageReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [requestDetailsSaved, setRequestDetailsSaved] = useState(false);
  const [requestDetails, setRequestDetails] = useState<BuilderRequestDetailsByBuilder>(
    createBuilderRequestDetails
  );
  const [activePlanner, setActivePlanner] = useState<SteelHomePlanner | null>(
    () => initialBuilder || currentPlanner()
  );
  const [requestSelection, setRequestSelection] = useState<SteelHomeRequestSelection | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const storage = typeof window === "undefined" ? null : window.localStorage;
    const loadedDraft = loadSteelHomeProjectDraft(storage);
    setDraft(loadedDraft);
    setRequestDetails(loadBuilderRequestDetails(storage, loadedDraft));
    setStorageReady(true);
    setSaved(Boolean(storage));
    setRequestDetailsSaved(Boolean(storage));
  }, []);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    setSaved(saveSteelHomeProjectDraft(window.localStorage, draft));
  }, [draft, storageReady]);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    setRequestDetailsSaved(saveBuilderRequestDetails(window.localStorage, requestDetails));
  }, [requestDetails, storageReady]);

  useEffect(() => {
    if (initialBuilder !== undefined) setActivePlanner(initialBuilder);
  }, [initialBuilder]);

  useEffect(() => {
    if (onNavigateBuilder || typeof window === "undefined") return;
    const restorePlanner = () => setActivePlanner(currentPlanner());
    window.addEventListener("hashchange", restorePlanner);
    window.addEventListener("popstate", restorePlanner);
    return () => {
      window.removeEventListener("hashchange", restorePlanner);
      window.removeEventListener("popstate", restorePlanner);
    };
  }, [onNavigateBuilder]);

  const openPlanner = useCallback(
    (planner: SteelHomePlanner) => {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setActivePlanner(planner);
      setRequestSelection(null);
      if (onNavigateBuilder) {
        onNavigateBuilder(planner);
        return;
      }
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", buildSteelHomeBuilderPath(planner));
      }
    },
    [onNavigateBuilder]
  );

  const closePlanner = useCallback(() => {
    const closedPlanner = activePlanner;
    setActivePlanner(null);
    setRequestSelection(null);
    if (onNavigateBuilder) {
      onNavigateBuilder(null);
    } else if (typeof window !== "undefined") {
      window.history.pushState(null, "", identity.publicRoute);
    }
    window.requestAnimationFrame(() => {
      if (closedPlanner) {
        document.getElementById(plannerLauncherId(closedPlanner))?.focus();
      } else {
        previousFocusRef.current?.focus?.();
      }
    });
  }, [activePlanner, onNavigateBuilder]);

  const updateRequestDraft = useCallback(
    (planner: SteelHomePlanner, nextDraft: SteelHomeProjectDraft) => {
      setRequestDetailsSaved(false);
      setRequestDetails((current) => ({
        ...current,
        [planner]: requestDetailsFromDraft(nextDraft),
      }));
    },
    []
  );

  const updateBuilding = useCallback((building: SteelHomeProjectDraft["building"]) => {
    setSaved(false);
    setDraft((current) => ({ ...current, building }));
  }, []);

  const updateCountertops = useCallback((countertops: SteelHomeProjectDraft["countertops"]) => {
    setSaved(false);
    setDraft((current) => ({ ...current, countertops }));
  }, []);

  const updateCabinets = useCallback((cabinets: SteelHomeProjectDraft["cabinets"]) => {
    setSaved(false);
    setDraft((current) => ({ ...current, cabinets }));
  }, []);

  const resetActiveBuilder = useCallback(() => {
    if (!activePlanner || typeof window === "undefined") return;
    const planner = STEEL_HOME_BUILDERS.find((item) => item.key === activePlanner);
    if (!window.confirm(`Reset every choice in the ${planner?.label || "open"} planner?`)) return;
    const empty = createEmptySteelHomeProjectDraft();
    setSaved(false);
    setRequestDetailsSaved(false);
    setDraft((current) => ({
      ...current,
      building: activePlanner === "building" ? empty.building : current.building,
      countertops: activePlanner === "countertops" ? empty.countertops : current.countertops,
      cabinets: activePlanner === "cabinets" ? empty.cabinets : current.cabinets,
    }));
    setRequestDetails((current) => ({
      ...current,
      [activePlanner]: requestDetailsFromDraft(empty),
    }));
  }, [activePlanner]);

  const activeBuilder = STEEL_HOME_BUILDERS.find((item) => item.key === activePlanner);
  const requestDraft = requestSelection
    ? { ...draft, ...requestDetails[requestSelection.planner] }
    : null;

  return (
    <main
      className="flex min-h-full flex-col bg-[#f5f1e8] text-[#18312f]"
      data-testid="steel-home-packages-profile"
      data-profile-slug={identity.slug}
      data-release-state={identity.releaseState}
    >
      <header className="flex h-16 shrink-0 items-center border-b border-[#18312f]/10 bg-[#f8f5ee] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1320px] items-center gap-3">
          <span className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[#a94f2e]">
            TradeScout
          </span>
          <span className="h-4 w-px bg-[#18312f]/20" aria-hidden="true" />
          <h1 className="font-editorial text-xl font-semibold tracking-[-0.025em] sm:text-2xl">
            Planning Tools
          </h1>
        </div>
      </header>

      {!storageReady ? (
        <div className="grid flex-1 place-items-center p-8 text-sm font-semibold text-[#68736f]">
          Opening the planners…
        </div>
      ) : !activePlanner ? (
        <SteelHomeBuilderDirectory onOpen={openPlanner} />
      ) : null}

      {activePlanner && activeBuilder ? (
        <section
          className="flex min-h-0 flex-1 flex-col bg-[#f5f1e8]"
          aria-labelledby="steel-home-active-planner-title"
          data-testid="steel-home-builder-workbench"
          data-builder={activePlanner}
        >
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#18312f]/12 bg-[#f8f5ee] px-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <a
                href={identity.publicRoute}
                onClick={(event) => {
                  if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  ) {
                    return;
                  }
                  event.preventDefault();
                  closePlanner();
                }}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#18312f]/15 bg-white transition hover:border-[#18312f]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e]"
                aria-label="Back to all planners"
                data-testid="steel-home-builder-close"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </a>
              <div className="min-w-0">
                <p className="hidden text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#a94f2e] sm:block">
                  Stand-alone planner
                </p>
                <h2
                  id="steel-home-active-planner-title"
                  className="truncate text-base font-black sm:text-lg"
                >
                  {activeBuilder.title}
                </h2>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className="hidden items-center gap-1.5 text-xs font-semibold text-[#68736f] sm:flex"
                aria-live="polite"
              >
                <Check className="h-3.5 w-3.5 text-[#a94f2e]" aria-hidden="true" />
                {saved ? "Saved on this device" : "Saving"}
              </span>
              <button
                type="button"
                onClick={resetActiveBuilder}
                className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-black text-[#5f6c68] transition hover:bg-[#18312f]/[0.06] hover:text-[#18312f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e]"
                data-testid="steel-home-builder-reset"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset
              </button>
            </div>
          </header>

          <div
            id={plannerPanelId(activePlanner)}
            className="min-h-0 flex-1"
            data-testid={plannerPanelId(activePlanner)}
          >
            <PlannerBodyBoundary plannerTitle={activeBuilder.title}>
              {activePlanner === "building" ? (
                <BuildingDesigner
                  design={draft.building}
                  onChange={updateBuilding}
                  extension={draft.building.planner}
                  onExtensionChange={(planner) =>
                    updateBuilding({ ...draft.building, included: true, planner })
                  }
                  onRequest={() => setRequestSelection({ planner: "building", intent: "builder" })}
                />
              ) : null}
              {activePlanner === "countertops" ? (
                <CountertopDesigner
                  design={draft.countertops}
                  onChange={updateCountertops}
                  onRequest={(intent) => setRequestSelection({ planner: "countertops", intent })}
                />
              ) : null}
              {activePlanner === "cabinets" ? (
                <CabinetDesigner
                  design={draft.cabinets}
                  onChange={updateCabinets}
                  plannerExtension={draft.cabinets.planner}
                  onPlannerExtensionChange={(planner) =>
                    updateCabinets({ ...draft.cabinets, planner })
                  }
                  onRequest={() => setRequestSelection({ planner: "cabinets", intent: "builder" })}
                />
              ) : null}
            </PlannerBodyBoundary>
          </div>
        </section>
      ) : null}

      {requestSelection && requestDraft ? (
        <SteelHomePlannerRequest
          request={requestSelection}
          draft={requestDraft}
          onChange={(nextDraft) => updateRequestDraft(requestSelection.planner, nextDraft)}
          requestHref={requestHref}
          laborRequestHref={laborRequestHref}
          saved={saved && requestDetailsSaved}
          onClose={() => setRequestSelection(null)}
        />
      ) : null}
    </main>
  );
}
