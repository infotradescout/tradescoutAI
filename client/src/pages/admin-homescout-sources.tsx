import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type HomeScoutSource = {
  id: string;
  sourceKey: string;
  sourceType: string;
  enabled: boolean;
  config: any;
  lastRunAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type IngestRun = {
  id: string;
  sourceId: string;
  status: string;
  stats: any;
  startedAt: string;
  finishedAt?: string | null;
  error?: string | null;
};

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export default function AdminHomeScoutSources() {
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState("seed_22105");
  const [newPath, setNewPath] = useState("data/homescout/seed-22105.json");
  const [autoActivate, setAutoActivate] = useState(true);
  const [staleAfterDays, setStaleAfterDays] = useState("7");

  const {
    data: sources = [],
    isLoading,
    isError,
    error,
  } = useQuery<HomeScoutSource[]>({
    queryKey: ["/api/admin/homescout/sources"],
    queryFn: () => apiJson("/api/admin/homescout/sources"),
  });

  const createSource = useMutation({
    mutationFn: async () =>
      apiJson<HomeScoutSource>("/api/admin/homescout/sources", {
        method: "POST",
        body: JSON.stringify({
          sourceKey: newKey.trim(),
          sourceType: "json_file",
          enabled: true,
          config: {
            path: newPath.trim(),
            autoActivate,
            staleAfterDays: Number(staleAfterDays) || 7,
          },
        }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/admin/homescout/sources"] });
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: async (p: { id: string; enabled: boolean; config: any; sourceType: string }) =>
      apiJson<HomeScoutSource>(`/api/admin/homescout/sources/${encodeURIComponent(p.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: p.enabled, config: p.config, sourceType: p.sourceType }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/admin/homescout/sources"] });
    },
  });

  const runSource = useMutation({
    mutationFn: async (id: string) =>
      apiJson<any>(`/api/admin/homescout/sources/${encodeURIComponent(id)}/run`, {
        method: "POST",
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/admin/homescout/sources"] });
    },
  });

  const SourceRuns = ({ sourceId }: { sourceId: string }) => {
    const { data: runs = [] } = useQuery<IngestRun[]>({
      queryKey: ["/api/admin/homescout/sources", sourceId, "runs"],
      queryFn: () =>
        apiJson(`/api/admin/homescout/sources/${encodeURIComponent(sourceId)}/runs?limit=10`),
    });
    if (!runs.length) return <div className="text-xs text-muted-foreground">No runs yet.</div>;
    return (
      <div className="space-y-2">
        {runs.map((r) => (
          <div key={r.id} className="text-xs flex items-center justify-between gap-3">
            <div className="truncate">
              <span className="font-medium">{r.status}</span>
              <span className="text-muted-foreground">
                {" "}
                · {new Date(r.startedAt).toLocaleString()}
              </span>
              {r.error ? <span className="text-red-400"> · {r.error}</span> : null}
            </div>
            <div className="text-muted-foreground whitespace-nowrap">
              {r.finishedAt
                ? `${Math.round((+new Date(r.finishedAt) - +new Date(r.startedAt)) / 1000)}s`
                : "running"}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const sorted = useMemo(() => {
    return [...sources].sort((a, b) => (a.sourceKey || "").localeCompare(b.sourceKey || ""));
  }, [sources]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>HomeScout Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Source Key</div>
              <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <div className="text-xs text-muted-foreground">JSON File Path (repo-relative)</div>
              <Input value={newPath} onChange={(e) => setNewPath(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Stale Days</div>
              <Input value={staleAfterDays} onChange={(e) => setStaleAfterDays(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Auto-activate ingested listings:{" "}
              <Button variant="secondary" size="sm" onClick={() => setAutoActivate((v) => !v)}>
                {autoActivate ? "On" : "Off"}
              </Button>
            </div>
            <Button onClick={() => createSource.mutate()} disabled={createSource.isPending}>
              Create Source
            </Button>
          </div>
          {createSource.isError ? (
            <div className="text-sm text-red-400">{String(createSource.error)}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enabled Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}
          {isError ? (
            <div className="text-sm text-red-400">{String((error as any)?.message || error)}</div>
          ) : null}
          {!isLoading && !sorted.length ? (
            <div className="text-sm text-muted-foreground">No sources yet.</div>
          ) : null}

          {sorted.map((s) => (
            <div key={s.id} className="border rounded-md p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{s.sourceKey}</div>
                    <Badge variant={s.enabled ? "default" : "secondary"}>
                      {s.enabled ? "enabled" : "disabled"}
                    </Badge>
                    <Badge variant="outline">{s.sourceType}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.lastSuccessAt
                      ? `Last success: ${new Date(s.lastSuccessAt).toLocaleString()}`
                      : "No success yet"}
                    {s.lastError ? ` · Error: ${s.lastError}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => runSource.mutate(s.id)}
                    disabled={runSource.isPending}
                  >
                    Run
                  </Button>
                  <Button
                    size="sm"
                    variant={s.enabled ? "destructive" : "default"}
                    onClick={() =>
                      toggleEnabled.mutate({
                        id: s.id,
                        enabled: !s.enabled,
                        config: s.config,
                        sourceType: s.sourceType,
                      })
                    }
                    disabled={toggleEnabled.isPending}
                  >
                    {s.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Config: <span className="font-mono">{JSON.stringify(s.config)}</span>
              </div>

              <div>
                <div className="text-xs font-medium mb-2">Recent Runs</div>
                <SourceRuns sourceId={s.id} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
