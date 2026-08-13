import { useCallback, useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { STEEL_HOME_PACKAGES_PROFILE_IDENTITY as identity } from "@shared/steelHomePackagesProfile";
import BuildingDesigner from "./steel-home-project-tools/BuildingDesigner";
import CabinetDesigner from "./steel-home-project-tools/CabinetDesigner";
import CountertopDesigner from "./steel-home-project-tools/CountertopDesigner";
import SteelHomePlannerNav, {
  STEEL_HOME_PLANNERS,
  STEEL_HOME_PLANNER_HASH,
  plannerFromHash,
  plannerPanelId,
  plannerTabId,
  type SteelHomePlanner,
} from "./steel-home-project-tools/SteelHomePlannerNav";
import SteelHomePlannerRequest from "./steel-home-project-tools/SteelHomePlannerRequest";
import {
  createEmptySteelHomeProjectDraft,
  loadSteelHomeProjectDraft,
  saveSteelHomeProjectDraft,
  type SteelHomeProjectDraft,
} from "./steel-home-project-tools/projectModel";

type Props = {
  requestHref: string;
  laborRequestHref: string;
  platformBaseHref?: string;
};

function initialPlanner(): SteelHomePlanner {
  return typeof window === "undefined" ? "countertops" : plannerFromHash(window.location.hash);
}

export default function SteelHomePackagesProfile({ requestHref }: Props) {
  const [draft, setDraft] = useState<SteelHomeProjectDraft>(() =>
    createEmptySteelHomeProjectDraft()
  );
  const [storageReady, setStorageReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activePlanner, setActivePlanner] = useState<SteelHomePlanner>(initialPlanner);
  const [requestPlanner, setRequestPlanner] = useState<SteelHomePlanner | null>(null);
  const skipInitialHashWrite = useRef(true);

  useEffect(() => {
    const storage = typeof window === "undefined" ? null : window.localStorage;
    setDraft(loadSteelHomeProjectDraft(storage));
    setStorageReady(true);
    setSaved(Boolean(storage));
  }, []);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    setSaved(saveSteelHomeProjectDraft(window.localStorage, draft));
  }, [draft, storageReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const restorePlanner = () => {
      setActivePlanner(plannerFromHash(window.location.hash));
      window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
    };
    window.addEventListener("hashchange", restorePlanner);
    window.addEventListener("popstate", restorePlanner);
    return () => {
      window.removeEventListener("hashchange", restorePlanner);
      window.removeEventListener("popstate", restorePlanner);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (skipInitialHashWrite.current) {
      skipInitialHashWrite.current = false;
      return;
    }
    const nextHash = STEEL_HOME_PLANNER_HASH[activePlanner];
    if (window.location.hash === nextHash) return;
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${nextHash}`
    );
  }, [activePlanner]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }, [activePlanner]);

  const openPlanner = useCallback((planner: SteelHomePlanner, focusPanel = false) => {
    setActivePlanner(planner);
    if (focusPanel && typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById(plannerPanelId(planner))?.focus();
      });
    }
  }, []);

  // Keep controlled text exactly as typed. Draft cleanup runs only while loading,
  // saving, and creating a request so spaces in place names and notes are not lost.
  const updateDraft = useCallback((nextDraft: SteelHomeProjectDraft) => {
    setSaved(false);
    setDraft(nextDraft);
  }, []);

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

  return (
    <main
      className="min-h-screen overflow-x-clip bg-[#f5f1e8] text-[#18312f]"
      data-testid="steel-home-packages-profile"
      data-profile-slug={identity.slug}
      data-release-state={identity.releaseState}
    >
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-4 border-b border-[#18312f]/10 bg-[#f7f3eb]/95 px-4 backdrop-blur sm:px-6">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[#a94f2e]">
              TradeScout
            </span>
            <span className="hidden h-4 w-px bg-[#18312f]/25 sm:block" aria-hidden="true" />
            <h1 className="truncate font-editorial text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
              Steel Home Planning Tools
            </h1>
          </div>
          <p className="mt-0.5 hidden text-xs text-[#68736f] sm:block">
            Three separate planners. Use only the one you need.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[#68736f]">
          <Save className="h-4 w-4 text-[#a94f2e]" aria-hidden="true" />
          <span className="hidden sm:inline" aria-live="polite">
            {saved ? "Saved on this device" : "Saving changes"}
          </span>
        </div>
      </header>

      <SteelHomePlannerNav activePlanner={activePlanner} onChange={openPlanner} />

      {!storageReady ? (
        <div className="grid min-h-[65vh] place-items-center p-8 text-sm font-semibold text-[#68736f]">
          Opening the planners…
        </div>
      ) : (
        <div className="min-h-[calc(100vh-7.5rem)]" data-testid="steel-home-planner-workbench">
          {STEEL_HOME_PLANNERS.map((planner) => {
            const active = activePlanner === planner.key;
            return (
              <div
                key={planner.key}
                id={plannerPanelId(planner.key)}
                role="tabpanel"
                aria-labelledby={plannerTabId(planner.key)}
                hidden={!active}
                tabIndex={-1}
                data-testid={plannerPanelId(planner.key)}
                className="min-h-full focus:outline-none"
              >
                {active && planner.key === "building" ? (
                  <BuildingDesigner
                    design={draft.building}
                    onChange={updateBuilding}
                    onRequest={() => setRequestPlanner("building")}
                  />
                ) : null}
                {active && planner.key === "countertops" ? (
                  <CountertopDesigner
                    design={draft.countertops}
                    onChange={updateCountertops}
                    onRequest={() => setRequestPlanner("countertops")}
                  />
                ) : null}
                {active && planner.key === "cabinets" ? (
                  <CabinetDesigner
                    design={draft.cabinets}
                    onChange={updateCabinets}
                    onRequest={() => setRequestPlanner("cabinets")}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {requestPlanner ? (
        <SteelHomePlannerRequest
          planner={requestPlanner}
          draft={draft}
          onChange={updateDraft}
          requestHref={requestHref}
          saved={saved}
          onClose={() => setRequestPlanner(null)}
        />
      ) : null}
    </main>
  );
}
