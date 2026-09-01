import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, RotateCcw, BookOpen } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type AuthorityConfigSnapshot = {
  loadedAt: string;
  fingerprint: string;
  adminTierRoles: string[];
  verificationBypassRoles: string[];
  privilegedAliasEmails: string[];
  directConnectUnverifiedBypassEnabled: boolean;
};

export default function AdminAuthorityPolicyPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<AuthorityConfigSnapshot>({
    queryKey: ["/api/admin/authority/config"],
    queryFn: () => apiRequest("GET", "/api/admin/authority/config"),
  });

  const reloadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/authority/config/reload"),
    onSuccess: () => {
      toast({
        title: "Authority config reloaded",
        description: "Environment-backed authority settings were refreshed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/authority/config"] });
    },
    onError: (error: any) => {
      toast({
        title: "Reload failed",
        description: formatUserFacingErrorMessage(error, "Could not reload authority config."),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-[color:var(--text-primary)]">
            <ShieldCheck className="h-4 w-4 text-ts-orange" />
            Authority & Verification Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-[color:var(--text-secondary)]">
          <p>
            This policy governs role- and flag-backed verification bypass, admin tier role
            recognition, and demo mode handling for Direct Connect. Configured recovery addresses
            are reserved identifiers only and never grant authority.
          </p>
          <p>
            All contact must remain gated by TradeScout law: discovery does not grant contact, and
            contact remains intent-based through governed pathways.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Single source: authorityConfig</Badge>
            <Badge variant="outline">Audit logged</Badge>
            <Badge variant="outline">Runtime refresh enabled</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-[color:var(--text-primary)]">
            Live config snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {isLoading ? (
            <p className="text-[color:var(--text-secondary)]">Loading authority config...</p>
          ) : !data ? (
            <p className="text-[color:var(--text-secondary)]">No config snapshot available.</p>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                    Loaded At
                  </p>
                  <p className="text-[color:var(--text-primary)]">
                    {new Date(data.loadedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                    Direct Connect Unverified
                  </p>
                  <p className="text-[color:var(--text-primary)]">
                    {data.directConnectUnverifiedBypassEnabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                  Admin tier roles
                </p>
                <p className="text-[color:var(--text-primary)]">{data.adminTierRoles.join(", ")}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                  Verification bypass roles
                </p>
                <p className="text-[color:var(--text-primary)]">
                  {data.verificationBypassRoles.join(", ")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                  Reserved recovery identifiers
                </p>
                <p className="text-[color:var(--text-primary)]">
                  {data.privilegedAliasEmails.length > 0
                    ? data.privilegedAliasEmails.join(", ")
                    : "None configured"}
                </p>
                <p className="text-xs text-[color:var(--text-secondary)]">
                  Reserved from public signup; these addresses do not grant roles or bypasses.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                  Fingerprint
                </p>
                <p className="break-all font-mono text-[11px] text-[color:var(--text-secondary)]">
                  {data.fingerprint}
                </p>
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => reloadMutation.mutate()}
              disabled={reloadMutation.isPending}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              {reloadMutation.isPending ? "Reloading..." : "Reload runtime config"}
            </Button>
            <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border-subtle)] px-3 py-1.5 text-xs text-[color:var(--text-secondary)]">
              <BookOpen className="h-3.5 w-3.5" />
              Policy doc location: docs/VERIFICATION_BYPASS_POLICY.md
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
