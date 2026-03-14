import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_CAPTURE_POLICIES,
  INSPECTION_MODES,
  INSPECTION_SURFACES,
  type InspectionMode,
  type InspectionSurface,
} from "@shared/inspectionIntelligence";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type InspectionCaseRow = {
  id: string;
  county_fips: string | null;
  state_code: string | null;
  surface: InspectionSurface;
  mode: InspectionMode;
  status: string;
  objective_text: string | null;
  total_photos: number;
  created_at: string;
};

type RecommendationResponse = {
  ok: boolean;
  case: Record<string, unknown>;
  snapshot: Record<string, unknown>;
  captureProgress: {
    totalPhotos: number;
    remainingToMinimum: number;
    maxBillablePhotos: number;
    capReached: boolean;
    targetConfidenceTier: string;
  };
  billingGuidance?: {
    canStopCapture: boolean;
    additionalPhotosSuggested: number;
    reason: string;
  };
};

async function jsonFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(body?.error || body?.message || `Request failed: ${res.status}`));
  }
  return body;
}

export default function AdminInspectionIntelligencePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [surface, setSurface] = useState<InspectionSurface>("exchange");
  const [mode, setMode] = useState<InspectionMode>("item_valuation");
  const [countyFips, setCountyFips] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [listingId, setListingId] = useState("");
  const [objectiveText, setObjectiveText] = useState("");

  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [artifactUrl, setArtifactUrl] = useState("");
  const [artifactType, setArtifactType] = useState("photo");
  const [qualityScore, setQualityScore] = useState("");
  const [manualNextSteps, setManualNextSteps] = useState(
    "Validate county checklist before submission\nUse minimum required photos first\nRoute to correct TradeScout surface for execution"
  );
  const [valuationAskPrice, setValuationAskPrice] = useState("");
  const [homeScoutListingId, setHomeScoutListingId] = useState("");
  const [homeScoutForceFresh, setHomeScoutForceFresh] = useState(false);
  const [directConnectForceFresh, setDirectConnectForceFresh] = useState(false);
  const [folderCountyFips, setFolderCountyFips] = useState("");
  const [folderStateCode, setFolderStateCode] = useState("");

  const casesQuery = useQuery({
    queryKey: ["/api/inspection/cases"],
    queryFn: async () => {
      const data = await jsonFetch("/api/inspection/cases?limit=30");
      return (Array.isArray(data?.rows) ? data.rows : []) as InspectionCaseRow[];
    },
  });

  const recommendationQuery = useQuery({
    queryKey: ["/api/inspection/cases", selectedCaseId, "recommendations"],
    enabled: Boolean(selectedCaseId),
    queryFn: async () =>
      (await jsonFetch(`/api/inspection/cases/${encodeURIComponent(selectedCaseId)}/recommendations`)) as RecommendationResponse,
  });

  const countyFolderQuery = useQuery({
    queryKey: ["/api/inspection/county-folder", folderCountyFips, folderStateCode],
    enabled: /^\d{5}$/.test(folderCountyFips.trim()),
    queryFn: async () => {
      const stateParam = folderStateCode.trim()
        ? `?stateCode=${encodeURIComponent(folderStateCode.trim().toUpperCase())}`
        : "";
      return jsonFetch(
        `/api/inspection/county/${encodeURIComponent(folderCountyFips.trim())}/folder${stateParam}`
      );
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: async () =>
      jsonFetch("/api/inspection/cases", {
        method: "POST",
        body: JSON.stringify({
          surface,
          mode,
          countyFips: countyFips.trim() || undefined,
          stateCode: stateCode.trim().toUpperCase() || undefined,
          listingId: listingId.trim() || undefined,
          objectiveText: objectiveText.trim() || undefined,
        }),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspection/cases"] });
      const caseId = String(data?.case?.id || "");
      if (caseId) setSelectedCaseId(caseId);
      toast({ title: "Case created", description: "Inspection case created for staff/admin testing." });
    },
    onError: (error) => {
      toast({
        title: "Create case failed",
        description: formatUserFacingErrorMessage(error, "Could not create inspection case."),
        variant: "destructive",
      });
    },
  });

  const addArtifactMutation = useMutation({
    mutationFn: async () =>
      jsonFetch(`/api/inspection/cases/${encodeURIComponent(selectedCaseId)}/artifacts`, {
        method: "POST",
        body: JSON.stringify({
          storageUrl: artifactUrl.trim(),
          artifactType,
          qualityScore: qualityScore.trim() ? Number(qualityScore) : undefined,
          metadata: { source: "admin_test_surface" },
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspection/cases"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection/cases", selectedCaseId, "recommendations"],
      });
      setArtifactUrl("");
      setQualityScore("");
      toast({ title: "Artifact added", description: "Photo/artifact saved with policy checks." });
    },
    onError: (error) => {
      toast({
        title: "Add artifact failed",
        description: formatUserFacingErrorMessage(error, "Could not add artifact."),
        variant: "destructive",
      });
    },
  });

  const saveManualRecommendationMutation = useMutation({
    mutationFn: async () => {
      const nextSteps = manualNextSteps
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return jsonFetch(`/api/inspection/cases/${encodeURIComponent(selectedCaseId)}/recommendations`, {
        method: "POST",
        body: JSON.stringify({
          sourcePriority: "first_party_admin_test",
          fallbackUsed: false,
          nextSteps,
          products: [],
          pros: [],
          requirements: [],
          costRanges: [],
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection/cases", selectedCaseId, "recommendations"],
      });
      toast({
        title: "Recommendation snapshot saved",
        description: "Manual test snapshot written for this case.",
      });
    },
    onError: (error) => {
      toast({
        title: "Save recommendation failed",
        description: formatUserFacingErrorMessage(error, "Could not save recommendation snapshot."),
        variant: "destructive",
      });
    },
  });

  const runExchangeValuationMutation = useMutation({
    mutationFn: async () =>
      jsonFetch(`/api/inspection/cases/${encodeURIComponent(selectedCaseId)}/exchange-valuation`, {
        method: "POST",
        body: JSON.stringify({
          askPrice: valuationAskPrice.trim() ? Number(valuationAskPrice) : undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection/cases", selectedCaseId, "recommendations"],
      });
      toast({
        title: "Exchange valuation created",
        description: "Fair-price band and fee preview saved to case snapshot.",
      });
    },
    onError: (error) => {
      toast({
        title: "Exchange valuation failed",
        description: formatUserFacingErrorMessage(error, "Could not run exchange valuation."),
        variant: "destructive",
      });
    },
  });

  const runHomeScoutAdapterMutation = useMutation({
    mutationFn: async () =>
      jsonFetch(`/api/inspection/cases/${encodeURIComponent(selectedCaseId)}/homescout-adapter`, {
        method: "POST",
        body: JSON.stringify({
          listingId: homeScoutListingId.trim() || undefined,
          forceFresh: homeScoutForceFresh,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection/cases", selectedCaseId, "recommendations"],
      });
      toast({
        title: "HomeScout adapter created",
        description: "HomeScout-first inspection snapshot saved for this case.",
      });
    },
    onError: (error) => {
      toast({
        title: "HomeScout adapter failed",
        description: formatUserFacingErrorMessage(error, "Could not run HomeScout adapter."),
        variant: "destructive",
      });
    },
  });

  const runDirectConnectAdapterMutation = useMutation({
    mutationFn: async () =>
      jsonFetch(`/api/inspection/cases/${encodeURIComponent(selectedCaseId)}/direct-connect-adapter`, {
        method: "POST",
        body: JSON.stringify({
          forceFresh: directConnectForceFresh,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection/cases", selectedCaseId, "recommendations"],
      });
      toast({
        title: "Direct Connect adapter created",
        description: "Direct Connect first-party snapshot saved for this case.",
      });
    },
    onError: (error) => {
      toast({
        title: "Direct Connect adapter failed",
        description: formatUserFacingErrorMessage(error, "Could not run Direct Connect adapter."),
        variant: "destructive",
      });
    },
  });

  const selectedPolicy = useMemo(
    () => DEFAULT_CAPTURE_POLICIES.find((p) => p.mode === mode),
    [mode]
  );

  return (
    <div className="space-y-6">
      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle>Inspection Intelligence (Staff/Admin Test)</CardTitle>
          <CardDescription>
            Test-only control surface for multi-mode inspection flow, photo caps, and recommendation snapshots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Surface</Label>
              <Select value={surface} onValueChange={(v) => setSurface(v as InspectionSurface)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSPECTION_SURFACES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as InspectionMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSPECTION_MODES.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>County FIPS</Label>
              <Input value={countyFips} onChange={(e) => setCountyFips(e.target.value)} placeholder="e.g. 22105" />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="LA" maxLength={2} />
            </div>
            <div className="space-y-2">
              <Label>Listing ID (optional)</Label>
              <Input value={listingId} onChange={(e) => setListingId(e.target.value)} placeholder="exchange-listing-id" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Objective</Label>
            <Textarea
              value={objectiveText}
              onChange={(e) => setObjectiveText(e.target.value)}
              placeholder="What should this case optimize for?"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              className="bg-ts-orange-dark hover:bg-ts-orange-dark"
              onClick={() => createCaseMutation.mutate()}
              disabled={createCaseMutation.isPending}
            >
              {createCaseMutation.isPending ? "Creating..." : "Create Inspection Case"}
            </Button>
            {selectedPolicy ? (
              <div className="text-xs text-white/70">
                Policy: min {selectedPolicy.minPhotos}, cap {selectedPolicy.maxBillablePhotos}, target {selectedPolicy.targetConfidence}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle>Cases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {casesQuery.isLoading ? <p className="text-white/70 text-sm">Loading cases...</p> : null}
          {(casesQuery.data || []).map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelectedCaseId(row.id)}
              className={`w-full rounded border p-3 text-left transition ${
                selectedCaseId === row.id ? "border-ts-orange bg-tsBg/80" : "border-white/10 bg-tsBg/40"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{row.surface}</Badge>
                <Badge variant="outline">{row.mode}</Badge>
                <Badge variant="secondary">{row.total_photos} photos</Badge>
                <span className="text-xs text-white/60">{new Date(row.created_at).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-sm text-white/80">{row.objective_text || "No objective text"}</div>
              <div className="mt-1 text-xs text-white/60">Case ID: {row.id}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle>County Visual Folder (Inspection Cases)</CardTitle>
          <CardDescription>
            Pull everything tied to a county block so admin can inspect by geography.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[220px_120px]">
            <Input
              value={folderCountyFips}
              onChange={(e) => setFolderCountyFips(e.target.value)}
              placeholder="County FIPS (e.g. 22105)"
            />
            <Input
              value={folderStateCode}
              onChange={(e) => setFolderStateCode(e.target.value)}
              placeholder="State (optional)"
              maxLength={2}
            />
          </div>

          {!/^\d{5}$/.test(folderCountyFips.trim()) ? (
            <p className="text-xs text-white/60">Enter a valid 5-digit county FIPS to load folder data.</p>
          ) : countyFolderQuery.isLoading ? (
            <p className="text-sm text-white/70">Loading county folder...</p>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-white/70">
                Cases: {Array.isArray((countyFolderQuery.data as any)?.cases) ? (countyFolderQuery.data as any).cases.length : 0}
              </div>
              <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-tsBg/50 p-2 text-xs text-white/80">
                {JSON.stringify((countyFolderQuery.data as any)?.summary || [], null, 2)}
              </pre>
              <div className="text-xs text-white/70">Requirement cache quality</div>
              <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-tsBg/50 p-2 text-xs text-white/80">
                {JSON.stringify((countyFolderQuery.data as any)?.requirementCache || [], null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCaseId ? (
        <Card className="bg-tsCard border-white/10">
          <CardHeader>
            <CardTitle>Selected Case Actions</CardTitle>
            <CardDescription>Case ID: {selectedCaseId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Add Artifact URL</Label>
              <div className="grid gap-3 md:grid-cols-[1fr_180px_130px_auto]">
                <Input
                  value={artifactUrl}
                  onChange={(e) => setArtifactUrl(e.target.value)}
                  placeholder="https://.../image.jpg"
                />
                <Input value={artifactType} onChange={(e) => setArtifactType(e.target.value)} placeholder="photo" />
                <Input value={qualityScore} onChange={(e) => setQualityScore(e.target.value)} placeholder="0.92" />
                <Button
                  onClick={() => addArtifactMutation.mutate()}
                  disabled={addArtifactMutation.isPending || !artifactUrl.trim()}
                  className="bg-ts-orange-dark hover:bg-ts-orange-dark"
                >
                  {addArtifactMutation.isPending ? "Adding..." : "Add Artifact"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Manual Recommendation Next Steps (one per line)</Label>
              <Textarea value={manualNextSteps} onChange={(e) => setManualNextSteps(e.target.value)} />
              <Button
                variant="outline"
                onClick={() => saveManualRecommendationMutation.mutate()}
                disabled={saveManualRecommendationMutation.isPending}
              >
                {saveManualRecommendationMutation.isPending
                  ? "Saving..."
                  : "Save Manual Recommendation Snapshot"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Exchange Fair-Price Valuation</Label>
              <div className="grid gap-3 md:grid-cols-[220px_auto]">
                <Input
                  value={valuationAskPrice}
                  onChange={(e) => setValuationAskPrice(e.target.value)}
                  placeholder="Ask price override (optional)"
                />
                <Button
                  className="bg-ts-orange-dark hover:bg-ts-orange-dark"
                  onClick={() => runExchangeValuationMutation.mutate()}
                  disabled={runExchangeValuationMutation.isPending}
                >
                  {runExchangeValuationMutation.isPending
                    ? "Running valuation..."
                    : "Run Exchange Valuation"}
                </Button>
              </div>
              <p className="text-xs text-white/60">
                Uses first-party Exchange comparables first, then fallback only if comp data is insufficient.
                Exchange fees always apply.
              </p>
            </div>

            <div className="space-y-2">
              <Label>HomeScout Adapter (first-party listing + inspection signals)</Label>
              <div className="grid gap-3 md:grid-cols-[280px_auto]">
                <Input
                  value={homeScoutListingId}
                  onChange={(e) => setHomeScoutListingId(e.target.value)}
                  placeholder="HomeScout listing id override (optional)"
                />
                <Button
                  className="bg-ts-orange-dark hover:bg-ts-orange-dark"
                  onClick={() => runHomeScoutAdapterMutation.mutate()}
                  disabled={runHomeScoutAdapterMutation.isPending}
                >
                  {runHomeScoutAdapterMutation.isPending
                    ? "Running HomeScout adapter..."
                    : "Run HomeScout Adapter"}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={homeScoutForceFresh}
                  onChange={(e) => setHomeScoutForceFresh(e.target.checked)}
                />
                Force fresh pull (skip cache reuse for this run)
              </label>
              <p className="text-xs text-white/60">
                Pulls HomeScout comps, inspection report activity, and county service-demand signals first;
                reuses recent county learning by default to reduce cost while keeping accuracy.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Direct Connect Adapter (first-party work request + routing signals)</Label>
              <div className="grid gap-3 md:grid-cols-[280px_auto]">
                <div className="text-xs text-white/70 rounded border border-white/10 bg-tsBg/50 p-3">
                  Uses county work request demand, assignment outcomes, and local pros to generate next steps.
                </div>
                <Button
                  className="bg-ts-orange-dark hover:bg-ts-orange-dark"
                  onClick={() => runDirectConnectAdapterMutation.mutate()}
                  disabled={runDirectConnectAdapterMutation.isPending}
                >
                  {runDirectConnectAdapterMutation.isPending
                    ? "Running Direct Connect adapter..."
                    : "Run Direct Connect Adapter"}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={directConnectForceFresh}
                  onChange={(e) => setDirectConnectForceFresh(e.target.checked)}
                />
                Force fresh pull (skip cache reuse for this run)
              </label>
            </div>

            <div className="rounded border border-white/10 bg-tsBg/50 p-3">
              {recommendationQuery.data?.billingGuidance ? (
                <div className="mb-3 rounded border border-white/10 bg-black/30 p-2 text-xs text-white/80">
                  <div>
                    Capture guidance:{" "}
                    <span className={recommendationQuery.data.billingGuidance.canStopCapture ? "text-emerald-300" : "text-amber-300"}>
                      {recommendationQuery.data.billingGuidance.canStopCapture ? "Stop capture now" : "Capture more"}
                    </span>
                  </div>
                  <div>{recommendationQuery.data.billingGuidance.reason}</div>
                  <div>
                    Additional photos suggested: {recommendationQuery.data.billingGuidance.additionalPhotosSuggested}
                  </div>
                </div>
              ) : null}
              <div className="mb-2 text-sm font-medium text-white">Latest Recommendation Payload</div>
              <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap text-xs text-white/80">
                {recommendationQuery.isLoading
                  ? "Loading..."
                  : JSON.stringify(recommendationQuery.data || {}, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
