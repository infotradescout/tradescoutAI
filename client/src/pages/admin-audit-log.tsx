import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSuperAdminLike } from "@/lib/roleChecks";

type AdminHealth = {
  role?: string | null;
  isSuperAdmin?: boolean;
};

type AuditEntry = {
  timestamp?: string;
  type?: string;
  adminId?: string;
  adminRole?: string;
  targetUserId?: string;
  targetPostId?: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  [key: string]: any;
};

export default function AdminAuditLogPage() {
  const [log, setLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterDraft, setFilterDraft] = useState({
    limit: "200",
    sort: "desc" as "asc" | "desc",
    action: "",
    actorId: "",
    from: "",
    to: "",
  });
  const [appliedFilter, setAppliedFilter] = useState({
    limit: "200",
    sort: "desc" as "asc" | "desc",
    action: "",
    actorId: "",
    from: "",
    to: "",
  });

  useEffect(() => {
    const run = async () => {
      try {
        const healthRes = await fetch("/api/admin/health", { credentials: "include" });
        if (!healthRes.ok) {
          setAllowed(false);
          return;
        }

        const health = (await healthRes.json()) as AdminHealth;
        const role = String(health?.role || "");
        const superAllowed = health?.isSuperAdmin === true || isSuperAdminLike(role);

        if (!superAllowed) {
          setAllowed(false);
          return;
        }

        setAllowed(true);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", appliedFilter.limit);
        params.set("sort", appliedFilter.sort);
        if (appliedFilter.action.trim()) params.set("action", appliedFilter.action.trim());
        if (appliedFilter.actorId.trim()) params.set("actorId", appliedFilter.actorId.trim());
        if (appliedFilter.from) params.set("from", new Date(appliedFilter.from).toISOString());
        if (appliedFilter.to) params.set("to", new Date(appliedFilter.to).toISOString());

        const auditRes = await fetch(`/api/admin/audit-log?${params.toString()}`, {
          credentials: "include",
        });
        if (!auditRes.ok) {
          setLog([]);
          setError("Unable to load audit log.");
          return;
        }

        const data = await auditRes.json();
        setLog(Array.isArray(data?.log) ? data.log : []);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [allowed, appliedFilter]);

  const onReset = () => {
    const resetValue = {
      limit: "200",
      sort: "desc" as "asc" | "desc",
      action: "",
      actorId: "",
      from: "",
      to: "",
    };
    setFilterDraft(resetValue);
    setAppliedFilter(resetValue);
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading audit log…</div>;
  }

  if (!allowed) {
    return <div className="p-8 text-center text-destructive">Access denied</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Admin Audit Log</h1>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="audit-limit">Limit</Label>
              <Select
                value={filterDraft.limit}
                onValueChange={(value) => setFilterDraft((prev) => ({ ...prev, limit: value }))}
              >
                <SelectTrigger id="audit-limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audit-sort">Sort</Label>
              <Select
                value={filterDraft.sort}
                onValueChange={(value: "asc" | "desc") =>
                  setFilterDraft((prev) => ({ ...prev, sort: value }))
                }
              >
                <SelectTrigger id="audit-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest first</SelectItem>
                  <SelectItem value="asc">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audit-action">Action</Label>
              <Input
                id="audit-action"
                value={filterDraft.action}
                onChange={(e) => setFilterDraft((prev) => ({ ...prev, action: e.target.value }))}
                placeholder="direct_connect.request.created"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audit-actor">Actor/Admin ID</Label>
              <Input
                id="audit-actor"
                value={filterDraft.actorId}
                onChange={(e) => setFilterDraft((prev) => ({ ...prev, actorId: e.target.value }))}
                placeholder="admin_123"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audit-from">From</Label>
              <Input
                id="audit-from"
                type="datetime-local"
                value={filterDraft.from}
                onChange={(e) => setFilterDraft((prev) => ({ ...prev, from: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audit-to">To</Label>
              <Input
                id="audit-to"
                type="datetime-local"
                value={filterDraft.to}
                onChange={(e) => setFilterDraft((prev) => ({ ...prev, to: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => setAppliedFilter(filterDraft)}>
              Apply
            </Button>
            <Button type="button" variant="outline" onClick={onReset}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Recent Authority Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm text-destructive mb-3">{error}</p> : null}
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {log.map((entry, i) => (
                <div
                  key={`${entry.timestamp || "t"}-${i}`}
                  className="p-3 border border-border rounded-md bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <Badge variant="outline">{entry.type || "unknown_action"}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "Unknown"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Admin: {entry.adminId || "unknown"}
                    {entry.adminRole ? ` (${entry.adminRole})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Target: {entry.targetUserId || entry.targetPostId || entry.targetId || "n/a"}
                    {entry.targetType ? ` · ${entry.targetType}` : ""}
                  </p>
                  {entry.reason ? (
                    <p className="text-xs text-foreground mt-1">Reason: {entry.reason}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
