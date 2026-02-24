import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
        const superAllowed =
          health?.isSuperAdmin === true || role === "super_admin" || role === "head_admin";

        if (!superAllowed) {
          setAllowed(false);
          return;
        }

        setAllowed(true);

        const auditRes = await fetch("/api/admin/audit-log?limit=200", { credentials: "include" });
        if (!auditRes.ok) {
          setLog([]);
          return;
        }

        const data = await auditRes.json();
        setLog(Array.isArray(data?.log) ? data.log : []);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

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
          <CardTitle className="text-base">Recent Authority Actions</CardTitle>
        </CardHeader>
        <CardContent>
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
