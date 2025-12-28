import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { WorkRequest } from "@shared/schema";
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
  return (
    <Card className="bg-slate-900/80 border-slate-800 p-3 md:p-4 h-full flex flex-col">
      <div className="mb-2">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Your Active Coordination
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Direct Connect is where local coordination happens. These are the things you're currently trying to get done.
        </p>
      </div>

      {!isAuthenticated ? (
        <div className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          Sign in to see and manage your active coordination in Direct Connect.
        </div>
      ) : isLoading ? (
        <div className="mt-3 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-md bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>
            No active coordination yet.
          </p>
          <p className="mt-1">
            When you start a Direct Connect request, it will appear here while Scout and your community work on it.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2 flex-1 overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2 text-xs flex flex-col gap-1"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium" style={{ color: "var(--text-primary)" }}>
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {item.primaryPhrase}
                  </div>
                  {item.secondaryPhrase && (
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {item.secondaryPhrase}
                    </div>
                  )}
                </div>
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/15 text-orange-300 border border-orange-400/60 whitespace-nowrap">
                  {item.state}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: "var(--text-secondary)" }}>
                <span>Last updated {formatRelativeTime(item.updatedAt)}</span>
                <button
                  type="button"
                  className="text-[10px] font-medium text-tsAccent hover:text-orange-400"
                  onClick={onViewBoard}
                >
                  View in Direct Connect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAuthenticated && (
        <div className="mt-3 pt-2 border-t border-slate-800 flex justify-end">
          <Button
            type="button"
            size="xs" asChild={false}
            className="h-7 px-3 text-[11px] bg-orange-500 hover:bg-orange-600 text-black font-semibold"
            onClick={onViewBoard}
          >
            Open Direct Connect
          </Button>
        </div>
      )}
    </Card>
  );
}

export const ScoutDirectConnectPanel: React.FC<ScoutDirectConnectPanelProps> = ({ isAuthenticated }) => {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<WorkRequest[]>({
    queryKey: ["/api/work-requests", "scout"],
    queryFn: async () => {
      const res = await fetch("/api/work-requests");
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
        return {
          id: String(wr.id),
          title: wr.title,
          state: interpreted.state,
          primaryPhrase: interpreted.primaryPhrase,
          secondaryPhrase: interpreted.secondaryPhrase,
          updatedAt: (wr as any).updatedAt ?? null,
        } satisfies ActiveCoordinationItem;
      })
      .filter((v): v is ActiveCoordinationItem => v !== null);
  }, [data]);

  const handleViewBoard = () => {
    navigate("/tasks");
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
