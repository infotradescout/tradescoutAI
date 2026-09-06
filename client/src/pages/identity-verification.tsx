import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { getCurrentInternalPath, readSafeReturnPath } from "@/lib/postOnboardingRoute";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, UploadCloud } from "lucide-react";

type DocType = "drivers_license" | "passport" | "state_id";

export default function IdentityVerificationPage() {
  const { user, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const returnPath = readSafeReturnPath(getCurrentInternalPath(location));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [docType, setDocType] = useState<DocType>("drivers_license");
  const [file, setFile] = useState<File | null>(null);

  const { data: status, isLoading } = useQuery<any>({
    queryKey: ["/api/identity-verification/status"],
    enabled: isAuthenticated,
    retry: false,
  });

  const tone = useMemo(() => {
    const isVerified = Boolean(status?.isVerified);
    const raw = String(status?.verification?.status || "").toLowerCase();
    if (isVerified) return "complete";
    if (raw === "submitted" || raw === "pending") return "pending";
    return "required";
  }, [status?.isVerified, status?.verification?.status]);

  const toneClass =
    tone === "complete"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : tone === "pending"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-rose-500/40 bg-rose-500/10 text-rose-200";

  const toneLabel = tone === "complete" ? "Verified" : tone === "pending" ? "Pending" : "Required";

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("Sign in first.");
      if (!file) throw new Error("Choose a document to upload.");

      const uploaded = await uploadPrivateObject(file);
      return apiRequest("POST", "/api/identity-verification/submit", {
        documentType: docType,
        objectKey: uploaded.objectKey,
      });
    },
    onSuccess: () => {
      toast({
        title: "Submitted",
        description: "Your ID verification is now pending review.",
      });
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/identity-verification/status"] });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't submit",
        description: formatUserFacingErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="px-4 py-4 md:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
            <CardHeader>
              <CardTitle className="text-[color:var(--text-primary)]">
                Identity verification
              </CardTitle>
              <CardDescription className="text-[color:var(--text-secondary)]">
                Sign in to upload an ID document.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/pre-scout-setup?mode=signin")}>Sign in</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 md:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[color:var(--text-primary)]">
              <ShieldCheck className="h-5 w-5 text-ts-orange" />
              Identity verification
            </CardTitle>
            <CardDescription className="text-[color:var(--text-secondary)]">
              Basic users verify identity + address. Unverified users can browse, but cannot
              initiate contact.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`rounded-lg border p-3 ${toneClass}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Status</div>
                <Badge variant="outline" className="border-current/40 text-current">
                  {toneLabel}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-[color:var(--text-secondary)]">
                Signed in as{" "}
                <span className="font-semibold text-[color:var(--text-primary)]">
                  {user?.email}
                </span>
                {isLoading ? " • Loading…" : ""}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Document type</Label>
              <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drivers_license">Driver’s license</SelectItem>
                  <SelectItem value="state_id">State ID</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Upload ID (photo or PDF)</Label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="text-xs text-[color:var(--text-muted)]">
                This file is stored privately and only used for verification review.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => navigate(returnPath || "/verification")}>
                {returnPath ? "Return to saved request" : "Back"}
              </Button>
              <Button
                disabled={submitMutation.isPending || !file}
                onClick={() => submitMutation.mutate()}
                className="gap-2"
              >
                <UploadCloud className="h-4 w-4" />
                {submitMutation.isPending ? "Submitting…" : "Submit for review"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
