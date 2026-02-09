import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { WorkRequest } from "@shared/schema";
import { ArrowUpRight, ListChecks, LoaderCircle, Plus } from "lucide-react";
import {
  interpretWorkRequestStateForScout,
  isActiveCoordinationState,
  type DirectConnectCanonicalState,
} from "@/utils/interpretWorkRequestState";

type ActiveCoordinationItem = {
  id: string;
  title: string;
  state: DirectConnectCanonicalState;
  primaryPhrase: string;
  secondaryPhrase?: string;
  updatedAt?: string | null;
};

interface ScoutDirectConnectPanelProps {
  isAuthenticated: boolean;
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "Recently";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "Recently";

  const now = Date.now();
  const diffMs = Math.max(0, now - ts);
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function ActiveCoordinationPanel({
  items,
  isLoading,
  isAuthenticated,
  onViewBoard,
}: {
  items: ActiveCoordinationItem[];
  isLoading: boolean;
  isAuthenticated: boolean;
  onViewBoard: () => void;
}) {
  const activeCount = items.length;
  const inProgressCount = items.filter((item) => item.state === "In discussion").length;

  return (
    <Card className="bg-slate-900/80 border-slate-800 p-3 md:p-4 h-full flex flex-col gap-3">
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-300">
            <ListChecks className="h-3.5 w-3.5" />
            Live Queue
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-300 hover:text-orange-200"
            onClick={onViewBoard}
          >
            Open
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Track active requests without leaving Scout.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Active</p>
            <p className="text-sm font-semibold text-slate-100">{activeCount}</p>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">In progress</p>
            <p className="text-sm font-semibold text-slate-100">{inProgressCount}</p>
          </div>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Sign in to view and manage your live requests in Direct Connect.
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-11 rounded-md border border-slate-800 bg-slate-900/70 animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          className="text-xs rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2"
          style={{ color: "var(--text-secondary)" }}
        >
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>
            No active requests yet.
          </p>
          <p className="mt-1">
            Start a Direct Connect request and it will appear here for live tracking.
          </p>
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-slate-800 bg-slate-900/80 px-2.5 py-2 text-xs flex flex-col gap-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate font-medium" style={{ color: "var(--text-primary)" }}>
                      {item.title}
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {item.primaryPhrase}
                    </div>
                    {item.secondaryPhrase && (
                      <div
                        className="mt-0.5 text-[11px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {item.secondaryPhrase}
                      </div>
                    )}
                  </div>
                </div>
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/15 text-orange-300 border border-orange-400/60 whitespace-nowrap">
                  {item.state.replace("_", " ")}
                </span>
              </div>
              <div
                className="flex items-center justify-between text-[10px]"
                style={{ color: "var(--text-secondary)" }}
              >
                <span>Updated {formatRelativeTime(item.updatedAt)}</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-300 hover:text-orange-200"
                  onClick={onViewBoard}
                >
                  View
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAuthenticated && (
        <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-[11px] border-slate-700 text-slate-200 hover:bg-slate-800"
            onClick={onViewBoard}
          >
            <LoaderCircle className="h-3.5 w-3.5 mr-1" />
            Queue
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 px-2.5 text-[11px] bg-orange-500 hover:bg-orange-600 text-black font-semibold"
            onClick={onViewBoard}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New request
          </Button>
        </div>
      )}
    </Card>
  );
}

export const ScoutDirectConnectPanel: React.FC<ScoutDirectConnectPanelProps> = ({
  isAuthenticated,
}) => {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<WorkRequest[]>({
    queryKey: ["/api/direct-connect/requests", "scout"],
    queryFn: async () => {
      const res = await fetch("/api/direct-connect/requests");
      if (!res.ok) throw new Error("Failed to fetch work requests");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const items: ActiveCoordinationItem[] = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    return data
      .map((wr) => {
        const interpreted = interpretWorkRequestStateForScout(wr);
        if (!isActiveCoordinationState(interpreted.state)) return null;
        const base = {
          id: String(wr.id),
          title: wr.title,
          state: interpreted.state,
          primaryPhrase: interpreted.primaryPhrase,
          updatedAt: (wr as any).updatedAt ?? null,
        };
        return interpreted.secondaryPhrase
          ? ({ ...base, secondaryPhrase: interpreted.secondaryPhrase } as ActiveCoordinationItem)
          : (base as ActiveCoordinationItem);
      })
      .filter((v): v is ActiveCoordinationItem => v !== null);
  }, [data]);

  const handleViewBoard = () => {
    navigate("/direct-connect");
  };

  return (
    <ActiveCoordinationPanel
      items={items}
      isLoading={isLoading}
      isAuthenticated={isAuthenticated}
      onViewBoard={handleViewBoard}
    />
  );
};
