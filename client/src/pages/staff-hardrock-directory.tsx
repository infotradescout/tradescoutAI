import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type ContractorApplication = {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  website?: string | null;
  primaryState: string;
  primaryCounty: string;
  yearsInBusiness: number;
  licenseNumber: string;
  insuranceProvider: string;
  primaryTrade: string;
  specialties: string[];
  about: string;
  preferredContact: string;
  status?: string | null;
  verificationStatus?: string | null;
  reviewNotes?: string | null;
  submittedAt?: string | null;
};

const STAFF_ALLOWED_ROLES = [
  "support_agent",
  "content_moderator",
  "territory_manager",
  "contractor_success",
  "content_seo",
  "analytics_specialist",
  "marketing_specialist",
  "moderator",
  "ops_admin",
  "super_admin",
] as const;

const STAFF_ROLE_SET = new Set<string>(STAFF_ALLOWED_ROLES);

function extractUploadLinks(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/\/uploads\/hardrock\/[^\s)"']+/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

export default function StaffHardrockDirectory() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const hasAccess = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    if (user.isAdmin === true) return true;
    return STAFF_ROLE_SET.has(String(user.role));
  }, [isAuthenticated, user]);

  const { data, isLoading, error } = useQuery<ContractorApplication[]>({
    queryKey: ["/api/staff/hardrock/applications", statusFilter],
    enabled: hasAccess,
    queryFn: async () => {
      const qs = statusFilter !== "all" ? `?status=${encodeURIComponent(statusFilter)}` : "";
      return apiRequest("GET", `/api/staff/hardrock/applications${qs}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; status?: string; reviewNotes?: string }) => {
      const { id, ...rest } = payload;
      return apiRequest("PUT", `/api/staff/hardrock/applications/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/hardrock/applications"] });
      toast({ title: "Updated", description: "Application updated." });
    },
    onError: (err: unknown) => {
      toast({
        title: "Update failed",
        description: formatUserFacingErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    },
  });

  if (!hasAccess) {
    // Avoid showing staff tools to regular users.
    setTimeout(() => setLocation("/unauthorized"), 0);
    return null;
  }

  return (
    <div className="text-white px-4 py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Hardrock contractor directory</h1>
            <p className="text-sm text-white/60">
              Commercial tradesmen submissions from `/hardrock`.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLocation("/staff/share-links")}>
              Share Links Library
            </Button>
            <div className="w-56">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="hardrock_pending">Pending</SelectItem>
                  <SelectItem value="hardrock_under_review">Under review</SelectItem>
                  <SelectItem value="hardrock_contacted">Contacted</SelectItem>
                  <SelectItem value="hardrock_approved">Approved</SelectItem>
                  <SelectItem value="hardrock_rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isLoading && <div className="text-sm text-white/60">Loading…</div>}
        {error && (
          <div className="text-sm text-destructive">
            {formatUserFacingErrorMessage(error, "Failed to load")}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {(data || []).map((app) => {
            const uploads = extractUploadLinks(app.reviewNotes);
            return (
              <Card key={app.id} className="bg-tsCard border border-white/10">
                <CardHeader className="flex flex-col gap-1">
                  <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                    <span>{app.companyName}</span>
                    <span className="text-xs text-white/60 font-normal">({app.primaryTrade})</span>
                    <span className="ml-auto text-xs text-white/60 font-normal">
                      {app.submittedAt ? new Date(app.submittedAt).toLocaleString() : ""}
                    </span>
                  </CardTitle>
                  <div className="text-xs text-white/60">
                    {app.primaryCounty}, {app.primaryState} • {app.phone} • {app.email}
                    {app.website ? ` • ${app.website}` : ""}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={String(app.status || "hardrock_pending")}
                        onValueChange={(value) =>
                          updateMutation.mutate({ id: app.id, status: value })
                        }
                        disabled={updateMutation.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hardrock_pending">Pending</SelectItem>
                          <SelectItem value="hardrock_under_review">Under review</SelectItem>
                          <SelectItem value="hardrock_contacted">Contacted</SelectItem>
                          <SelectItem value="hardrock_approved">Approved</SelectItem>
                          <SelectItem value="hardrock_rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Specialties</Label>
                      <div className="text-sm text-white">{(app.specialties || []).join(", ")}</div>
                    </div>
                  </div>

                  <div>
                    <Label>About</Label>
                    <div className="text-sm text-white whitespace-pre-wrap">{app.about}</div>
                  </div>

                  {uploads.length > 0 && (
                    <div>
                      <Label>Uploads</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {uploads.map((u) => (
                          <a
                            key={u}
                            href={u}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs rounded-full border border-white/10 px-3 py-1 hover:bg-white/5"
                          >
                            {u.split("/").slice(-1)[0]}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                    <div>
                      <Label>Internal notes</Label>
                      <Input
                        defaultValue={app.reviewNotes || ""}
                        placeholder="Add a quick note…"
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          const next = (e.target as HTMLInputElement).value || "";
                          updateMutation.mutate({ id: app.id, reviewNotes: next });
                        }}
                        disabled={updateMutation.isPending}
                      />
                      <p className="text-xs text-white/60 mt-1">Press Enter to save.</p>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const mailto = `mailto:${app.email}?subject=${encodeURIComponent(
                            "TradeScout commercial jobs"
                          )}`;
                          window.location.href = mailto;
                        }}
                      >
                        Email
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {!isLoading && (data || []).length === 0 && (
          <div className="text-sm text-white/60">No applications found.</div>
        )}
      </div>
    </div>
  );
}
