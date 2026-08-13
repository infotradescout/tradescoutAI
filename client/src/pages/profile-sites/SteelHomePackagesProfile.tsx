import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import {
  STEEL_HOME_PACKAGES_PROFILE_CONTENT as content,
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY as identity,
} from "@shared/steelHomePackagesProfile";
import BuildingDesigner from "./steel-home-project-tools/BuildingDesigner";
import CabinetDesigner from "./steel-home-project-tools/CabinetDesigner";
import CountertopDesigner from "./steel-home-project-tools/CountertopDesigner";
import ProjectStart from "./steel-home-project-tools/ProjectStart";
import SteelHomeProjectReview from "./steel-home-project-tools/SteelHomeProjectReview";
import WholeHomePlanner from "./steel-home-project-tools/WholeHomePlanner";
import SteelHomeProjectSummary, {
  getSteelHomeWorkspaceStatuses,
} from "./steel-home-project-tools/SteelHomeProjectSummary";
import SteelHomeWorkspaceNav, {
  STEEL_HOME_WORKSPACES,
  STEEL_HOME_WORKSPACE_HASH,
  type SteelHomeWorkspace,
  workspaceFromHash,
  workspacePanelId,
} from "./steel-home-project-tools/SteelHomeWorkspaceNav";
import {
  clearSteelHomeProjectDraft,
  createEmptySteelHomeProjectDraft,
  loadSteelHomeProjectDraft,
  reconcileSteelHomeProjectDraft,
  saveSteelHomeProjectDraft,
  type SteelHomeProjectDraft,
} from "./steel-home-project-tools/projectModel";

type Props = {
  requestHref: string;
  laborRequestHref: string;
  platformBaseHref?: string;
};

function initialWorkspace(): SteelHomeWorkspace {
  return typeof window === "undefined" ? "project" : workspaceFromHash(window.location.hash);
}

export default function SteelHomePackagesProfile({ requestHref, laborRequestHref }: Props) {
  const [draft, setDraft] = useState<SteelHomeProjectDraft>(() =>
    createEmptySteelHomeProjectDraft()
  );
  const [storageReady, setStorageReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<SteelHomeWorkspace>(initialWorkspace);
  const [visitedWorkspaces, setVisitedWorkspaces] = useState<Set<SteelHomeWorkspace>>(
    () => new Set([initialWorkspace()])
  );
  const [resetGeneration, setResetGeneration] = useState(0);
  const skipNextSave = useRef(false);
  const workbenchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storage = typeof window === "undefined" ? null : window.localStorage;
    setDraft(loadSteelHomeProjectDraft(storage));
    setStorageReady(true);
    setSaved(Boolean(storage));
  }, []);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSaved(saveSteelHomeProjectDraft(window.localStorage, draft));
  }, [draft, storageReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const restoreWorkspace = () => {
      const next = workspaceFromHash(window.location.hash);
      setActiveWorkspace(next);
      setVisitedWorkspaces((current) => new Set(current).add(next));
      window.requestAnimationFrame(() => {
        workbenchRef.current?.scrollTo?.({ top: 0 });
        window.scrollTo?.({ top: 0 });
      });
    };
    window.addEventListener("hashchange", restoreWorkspace);
    window.addEventListener("popstate", restoreWorkspace);
    return () => {
      window.removeEventListener("hashchange", restoreWorkspace);
      window.removeEventListener("popstate", restoreWorkspace);
    };
  }, []);

  const updateDraft = useCallback((nextDraft: SteelHomeProjectDraft) => {
    setSaved(false);
    setDraft(reconcileSteelHomeProjectDraft(nextDraft));
  }, []);

  const updateBuilding = useCallback((building: SteelHomeProjectDraft["building"]) => {
    setSaved(false);
    setDraft((current) => reconcileSteelHomeProjectDraft({ ...current, building }));
  }, []);

  const updateCountertops = useCallback((countertops: SteelHomeProjectDraft["countertops"]) => {
    setSaved(false);
    setDraft((current) => reconcileSteelHomeProjectDraft({ ...current, countertops }));
  }, []);

  const updateCabinets = useCallback((cabinets: SteelHomeProjectDraft["cabinets"]) => {
    setSaved(false);
    setDraft((current) => reconcileSteelHomeProjectDraft({ ...current, cabinets }));
  }, []);

  const openWorkspace = useCallback(
    (workspace: SteelHomeWorkspace, replace = false, focusPanel = false) => {
      setActiveWorkspace(workspace);
      setVisitedWorkspaces((current) => new Set(current).add(workspace));
      if (typeof window !== "undefined") {
        const nextHash = STEEL_HOME_WORKSPACE_HASH[workspace];
        const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
        if (window.location.hash !== nextHash) {
          if (replace) window.history.replaceState(null, "", nextUrl);
          else window.history.pushState(null, "", nextUrl);
        }
        window.requestAnimationFrame(() => {
          workbenchRef.current?.scrollTo?.({ top: 0 });
          window.scrollTo?.({ top: 0 });
          if (focusPanel) document.getElementById(workspacePanelId(workspace))?.focus();
        });
      }
    },
    []
  );

  const resetDraft = useCallback(() => {
    const confirmed =
      typeof window === "undefined" ||
      typeof window.confirm !== "function" ||
      window.confirm("Clear all project choices, measurements, and trade selections?");
    if (!confirmed) return;

    skipNextSave.current = true;
    if (typeof window !== "undefined") clearSteelHomeProjectDraft(window.localStorage);
    setDraft(createEmptySteelHomeProjectDraft());
    setSaved(true);
    setResetGeneration((current) => current + 1);
    setVisitedWorkspaces(new Set(["project"]));
    openWorkspace("project", true);
  }, [openWorkspace]);

  const statuses = useMemo(() => getSteelHomeWorkspaceStatuses(draft), [draft]);
  const activeIndex = STEEL_HOME_WORKSPACES.findIndex((item) => item.key === activeWorkspace);
  const previousWorkspace = activeIndex > 0 ? STEEL_HOME_WORKSPACES[activeIndex - 1] : null;
  const nextWorkspace =
    activeIndex < STEEL_HOME_WORKSPACES.length - 1 ? STEEL_HOME_WORKSPACES[activeIndex + 1] : null;

  const workspacePanels: Record<SteelHomeWorkspace, ReactNode> = {
    project: <ProjectStart draft={draft} onChange={updateDraft} />,
    building: <BuildingDesigner design={draft.building} onChange={updateBuilding} />,
    countertops: (
      <CountertopDesigner
        key={`countertops-${resetGeneration}`}
        design={draft.countertops}
        onChange={updateCountertops}
      />
    ),
    cabinets: <CabinetDesigner design={draft.cabinets} onChange={updateCabinets} />,
    "whole-home": <WholeHomePlanner draft={draft} onChange={updateDraft} />,
    review: (
      <SteelHomeProjectReview
        draft={draft}
        requestHref={requestHref}
        laborRequestHref={laborRequestHref}
        saved={saved}
        onChange={updateDraft}
        onReset={resetDraft}
      />
    ),
  };

  return (
    <main
      className="min-h-screen overflow-x-clip bg-[#f5f1e8] pb-24 text-[#18312f] xl:h-screen xl:min-h-0 xl:overflow-hidden xl:pb-0"
      data-testid="steel-home-packages-profile"
      data-profile-slug={identity.slug}
      data-release-state={identity.releaseState}
    >
      <header className="sticky top-0 z-50 flex min-h-16 items-center justify-between gap-4 border-b border-[#18312f]/10 bg-[#f7f3eb] px-4 sm:px-6 xl:static">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[#a94f2e]">
              TradeScout
            </span>
            <span className="hidden h-4 w-px bg-[#18312f]/25 sm:block" aria-hidden="true" />
            <h1 className="truncate font-editorial text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
              {content.header.label}
            </h1>
          </div>
          <p className="mt-0.5 hidden text-xs text-[#68736f] sm:block">
            Plan packages, compare estimates, and request quotes.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#68736f]">
          <Save className="h-4 w-4 text-[#a94f2e]" aria-hidden="true" />
          <span className="hidden sm:inline">
            {saved ? "Saved on this device" : "Saving changes"}
          </span>
        </div>
      </header>

      <SteelHomeWorkspaceNav
        mobile
        activeWorkspace={activeWorkspace}
        statuses={statuses}
        onChange={openWorkspace}
      />

      <div className="xl:grid xl:h-[calc(100vh-64px)] xl:grid-cols-[248px_minmax(0,1fr)] 2xl:grid-cols-[248px_minmax(0,1fr)_304px]">
        <aside className="hidden min-h-0 flex-col border-r border-[#18312f]/10 bg-[#eee7dc] p-4 xl:flex">
          <SteelHomeWorkspaceNav
            activeWorkspace={activeWorkspace}
            statuses={statuses}
            onChange={openWorkspace}
          />
          <p className="mt-5 border-t border-[#18312f]/10 pt-4 text-xs leading-5 text-[#68736f]">
            Connection Without Compromise
          </p>
        </aside>

        <div className="min-h-0 min-w-0 bg-[#f5f1e8] xl:flex xl:h-full xl:flex-col xl:overflow-hidden">
          <SteelHomeProjectSummary
            draft={draft}
            saved={saved}
            onOpenReview={() => openWorkspace("review", false, true)}
            layout="strip"
          />
          <div
            ref={workbenchRef}
            className="min-h-0 flex-1 xl:overflow-y-auto"
            data-testid="steel-home-workbench"
          >
            {!storageReady ? (
              <div className="grid min-h-[60vh] place-items-center p-8 text-sm font-semibold text-[#68736f]">
                Opening your project…
              </div>
            ) : (
              <>
                {STEEL_HOME_WORKSPACES.map((workspace) => {
                  const active = activeWorkspace === workspace.key;
                  return (
                    <div
                      key={workspace.key}
                      id={workspacePanelId(workspace.key)}
                      role="tabpanel"
                      aria-label={workspace.label}
                      hidden={!active}
                      tabIndex={-1}
                      data-testid={workspacePanelId(workspace.key)}
                      className="min-h-full"
                    >
                      {active || visitedWorkspaces.has(workspace.key)
                        ? workspacePanels[workspace.key]
                        : null}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {storageReady ? (
            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#18312f]/10 bg-[#f7f3eb] px-4 py-3 sm:px-6">
              {previousWorkspace ? (
                <button
                  type="button"
                  onClick={() => openWorkspace(previousWorkspace.key, false, true)}
                  aria-label={`Previous: ${previousWorkspace.label}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#18312f]/20 px-5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18312f]"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {previousWorkspace.label}
                </button>
              ) : (
                <span />
              )}
              {nextWorkspace ? (
                <button
                  type="button"
                  onClick={() => openWorkspace(nextWorkspace.key, false, true)}
                  aria-label={`Next: ${nextWorkspace.label}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#18312f] px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18312f]"
                >
                  {nextWorkspace.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <SteelHomeProjectSummary
          draft={draft}
          saved={saved}
          onOpenReview={() => openWorkspace("review", false, true)}
        />
      </div>

      <SteelHomeProjectSummary
        draft={draft}
        saved={saved}
        onOpenReview={() => openWorkspace("review", false, true)}
        layout="mobile"
      />
    </main>
  );
}
