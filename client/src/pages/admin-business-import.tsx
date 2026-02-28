import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Building2, AlertTriangle } from "lucide-react";

type ImportResponse = {
  dryRun: boolean;
  delimiter: "comma" | "tab" | "pipe";
  totals: {
    rows: number;
    createdUsers: number;
    updatedUsers: number;
    createdBusinesses: number;
    updatedBusinesses: number;
    createdUnclaimedBusinesses?: number;
    updatedUnclaimedBusinesses?: number;
    createdPublicProfiles?: number;
    activationPrepared: number;
    activationEmailed: number;
  };
  activationLinkExport?: { requested: boolean; allowed: boolean; reason?: string | null };
  results: Array<{
    row: number;
    email: string;
    businessName: string;
    countyFips: string;
    status: "ok" | "error" | "dry_run";
    error?: string;
    userId?: string | null;
    businessId?: string | null;
    profileSlug?: string | null;
    publicProfileSlug?: string | null;
    activationLink?: string;
  }>;
};

type ImportBatchSummary = {
  batchId: string;
  source: string;
  totalRows: number;
  pendingRows: number;
  mergedRows: number;
  failedRows: number;
  skippedRows: number;
  latestCreatedAt: string | null;
};

type StagedImportRow = {
  id: string;
  batchId: string;
  source: string;
  name: string;
  email: string | null;
  phone: string | null;
  stateCode: string | null;
  countyFips: string | null;
  status: string;
  mergeNotes: string | null;
  mergedBusinessId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ImportProgress = {
  totalChunks: number;
  currentChunk: number;
  processedRows: number;
};

// Large imports are uploaded in multiple requests to avoid per-request payload limits (413).
// There is no cap on total rows; we just split into parts.
const CHUNK_TARGET_CHARS = 400_000;

function looksLikeHeaderLine(line: string): boolean {
  const normalized = String(line || "").toLowerCase();
  return ["email", "business", "company", "phone", "county", "fips", "state"].some((k) =>
    normalized.includes(k)
  );
}

function splitIntoImportChunks(raw: string): { chunks: string[]; estimatedRows: number } {
  const normalized = String(raw || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const header = lines[0] || "";
  const includeHeader = looksLikeHeaderLine(header);
  const dataLines = includeHeader ? lines.slice(1) : lines;

  const chunks: string[] = [];
  let current: string[] = [];
  let currentChars = 0;

  const pushChunk = () => {
    if (!current.length) return;
    const payload = includeHeader ? `${header}\n${current.join("\n")}` : current.join("\n");
    chunks.push(payload);
    current = [];
    currentChars = 0;
  };

  for (const line of dataLines) {
    const nextLen = (line?.length ?? 0) + 1;
    if (currentChars + nextLen > CHUNK_TARGET_CHARS && current.length) {
      pushChunk();
    }
    current.push(line);
    currentChars += nextLen;
  }

  pushChunk();

  const estimatedRows = Math.max(0, dataLines.filter((l) => String(l || "").trim().length > 0).length);
  return { chunks: chunks.filter((c) => c.trim().length > 0), estimatedRows };
}

export default function AdminBusinessImport() {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [source, setSource] = useState("csv_manual");
  const [dryRun, setDryRun] = useState(false);
  const [sendActivationEmails, setSendActivationEmails] = useState(false);
  const [includeActivationLinks, setIncludeActivationLinks] = useState(false);
  const [createPublicProfiles, setCreatePublicProfiles] = useState(false);
  const [defaultCountyFips, setDefaultCountyFips] = useState("");
  const [defaultStateCode, setDefaultStateCode] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedBatchStatus, setSelectedBatchStatus] = useState("all");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [enrichLimit, setEnrichLimit] = useState("100");
  const [enrichDryRun, setEnrichDryRun] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [loadedFileMeta, setLoadedFileMeta] = useState<{ name: string; sizeBytes: number } | null>(
    null
  );

  const {
    data: batchData,
    isLoading: batchesLoading,
    refetch: refetchBatches,
  } = useQuery({
    queryKey: ["/api/admin/businesses/import/batches"],
    queryFn: async () =>
      ((await apiRequest("GET", "/api/admin/businesses/import/batches")) as {
        batches?: ImportBatchSummary[];
      }) || { batches: [] },
  });
  const batches = batchData?.batches || [];
  const effectiveBatchId = selectedBatchId || batches[0]?.batchId || "";

  const {
    data: batchRowsData,
    isLoading: batchRowsLoading,
    refetch: refetchBatchRows,
  } = useQuery({
    queryKey: ["/api/admin/businesses/import/batches", effectiveBatchId, selectedBatchStatus],
    enabled: Boolean(effectiveBatchId),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (selectedBatchStatus !== "all") {
        params.set("status", selectedBatchStatus);
      }
      return (
        ((await apiRequest(
          "GET",
          `/api/admin/businesses/import/batches/${encodeURIComponent(effectiveBatchId)}?${params.toString()}`
        )) as { rows?: StagedImportRow[] }) || { rows: [] }
      );
    },
  });
  const batchRows = batchRowsData?.rows || [];

  const importMutation = useMutation({
    mutationFn: async () => {
      const { chunks, estimatedRows } = splitIntoImportChunks(content);
      if (chunks.length <= 1) {
        const res = await apiRequest("/api/admin/businesses/import", {
          method: "POST",
          timeoutMs: 120_000,
          body: {
            content,
            source: source.trim() || "csv_manual",
            dryRun,
            sendActivationEmails,
            includeActivationLinks,
            createPublicProfiles,
            defaultCountyFips: defaultCountyFips.trim() || undefined,
            defaultStateCode: defaultStateCode.trim() || undefined,
          },
        });
        return res as ImportResponse;
      }

      // Chunked upload to avoid 413 payload limits in production.
      const combined: ImportResponse = {
        dryRun,
        delimiter: "comma",
        totals: {
          rows: 0,
          createdUsers: 0,
          updatedUsers: 0,
          createdBusinesses: 0,
          updatedBusinesses: 0,
          createdUnclaimedBusinesses: 0,
          updatedUnclaimedBusinesses: 0,
          createdPublicProfiles: 0,
          activationPrepared: 0,
          activationEmailed: 0,
        },
        results: [],
      };

      let rowOffset = 0;
      setImportProgress({ totalChunks: chunks.length, currentChunk: 1, processedRows: 0 });

      for (let i = 0; i < chunks.length; i++) {
        setImportProgress({
          totalChunks: chunks.length,
          currentChunk: i + 1,
          processedRows: combined.totals.rows,
        });

        const res = (await apiRequest("POST", "/api/admin/businesses/import", {
          method: "POST",
          timeoutMs: 120_000,
          body: {
            content: chunks[i],
            source: source.trim() || "csv_manual",
            dryRun,
            sendActivationEmails,
            includeActivationLinks,
            createPublicProfiles,
            defaultCountyFips: defaultCountyFips.trim() || undefined,
            defaultStateCode: defaultStateCode.trim() || undefined,
          },
        })) as ImportResponse;

        combined.delimiter = res.delimiter;
        combined.activationLinkExport = res.activationLinkExport;
        combined.totals.rows += res.totals.rows;
        combined.totals.createdUsers += res.totals.createdUsers;
        combined.totals.updatedUsers += res.totals.updatedUsers;
        combined.totals.createdBusinesses += res.totals.createdBusinesses;
        combined.totals.updatedBusinesses += res.totals.updatedBusinesses;
        combined.totals.createdUnclaimedBusinesses =
          (combined.totals.createdUnclaimedBusinesses || 0) + (res.totals.createdUnclaimedBusinesses || 0);
        combined.totals.updatedUnclaimedBusinesses =
          (combined.totals.updatedUnclaimedBusinesses || 0) + (res.totals.updatedUnclaimedBusinesses || 0);
        combined.totals.createdPublicProfiles =
          (combined.totals.createdPublicProfiles || 0) + (res.totals.createdPublicProfiles || 0);
        combined.totals.activationPrepared += res.totals.activationPrepared;
        combined.totals.activationEmailed += res.totals.activationEmailed;

        combined.results.push(
          ...(res.results || []).map((r) => ({
            ...r,
            row: typeof r.row === "number" ? r.row + rowOffset : r.row,
          }))
        );
        rowOffset += res.totals.rows;
      }

      setImportProgress(null);

      toast({
        title: "Chunked import complete",
        description: `Uploaded ${chunks.length} chunks (${combined.totals.rows}/${estimatedRows} rows processed).`,
      });

      return combined;
    },
    onSuccess: (data) => {
      setImportProgress(null);
      setResult(data);
      void refetchBatches();
      void refetchBatchRows();
      toast({
        title: "Import complete",
        description: `Rows: ${data.totals.rows} - Users created: ${data.totals.createdUsers} - Businesses created: ${data.totals.createdBusinesses}`,
      });
    },
    onError: (error: any) => {
      setImportProgress(null);
      toast({
        title: "Import failed",
        description: error?.message || "Failed to import",
        variant: "destructive",
      });
    },
  });

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const limit = parseInt(enrichLimit, 10);
      const res = await apiRequest("/api/admin/businesses/enrich-counties", {
        method: "POST",
        timeoutMs: 120_000,
        body: {
          limit: Number.isFinite(limit) ? limit : 100,
          dryRun: enrichDryRun,
          onlyUnclaimed: true,
        },
      });
      return res as any;
    },
    onSuccess: (data: any) => {
      toast({
        title: enrichDryRun ? "Enrichment dry run complete" : "County enrichment complete",
        description: `Scanned: ${data?.summary?.scanned ?? 0} - Enriched: ${data?.summary?.enriched ?? 0} - Not found: ${data?.summary?.notFound ?? 0}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Enrichment failed",
        description: error?.message || "Failed to enrich counties",
        variant: "destructive",
      });
    },
  });

  const onFileSelected = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setContent(text);
    setLoadedFileMeta({ name: file.name, sizeBytes: file.size });
    toast({ title: "Loaded file", description: file.name });
  };

  const chunkPreview = useMemo(() => {
    if (!content.trim()) return null;
    const { chunks, estimatedRows } = splitIntoImportChunks(content);
    return { chunks: chunks.length, estimatedRows };
  }, [content]);

  const errorCount = useMemo(
    () => (result?.results || []).filter((r) => r.status === "error").length,
    [result]
  );
  const okCount = useMemo(
    () => (result?.results || []).filter((r) => r.status === "ok").length,
    [result]
  );

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Building2 className="h-5 w-5 text-ts-orange" />
            Business Import (Admin)
          </CardTitle>
          <CardDescription className="text-[color:var(--text-secondary)]">
            Upload CSV/TSV/text to create claimable business directory entries and (optionally)
            pre-create business owner accounts. Imported businesses still must finish their profile
            and pass verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1">
              <label className="text-xs text-white/60">Upload file</label>
              <Input
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
                className="bg-black/30 border-[color:var(--border-subtle)]"
              />
            </div>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || !content.trim()}
              className="bg-ts-orange text-black hover:bg-ts-orange-dark shadow-lg shadow-ts-orange/25"
            >
              <Upload className="h-4 w-4 mr-2" />
              {importMutation.isPending ? "Importing..." : dryRun ? "Dry Run" : "Import"}
            </Button>
          </div>

          {importProgress ? (
            <div className="text-xs text-white/60">
              Uploading chunk {importProgress.currentChunk}/{importProgress.totalChunks}. Processed{" "}
              {importProgress.processedRows} rows so far.
            </div>
          ) : chunkPreview ? (
            <div className="text-xs text-white/60">
              {loadedFileMeta ? (
                <>
                  Loaded <span className="text-white/70">{loadedFileMeta.name}</span> (
                  {(loadedFileMeta.sizeBytes / (1024 * 1024)).toFixed(1)} MB).{" "}
                </>
              ) : null}
              Estimated rows: <span className="text-white/70">{chunkPreview.estimatedRows}</span>.{" "}
              This import will upload in <span className="text-white/70">{chunkPreview.chunks}</span>{" "}
              parts to avoid per-request payload limits. No row cap.
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60">Source label</label>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g., county_open_data"
                className="bg-black/30 border-[color:var(--border-subtle)]"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Default county FIPS (optional)</label>
              <Input
                value={defaultCountyFips}
                onChange={(e) => setDefaultCountyFips(e.target.value)}
                placeholder="e.g., 48201"
                className="bg-black/30 border-[color:var(--border-subtle)]"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Default state code (optional)</label>
              <Input
                value={defaultStateCode}
                onChange={(e) => setDefaultStateCode(e.target.value)}
                placeholder="e.g., TX"
                className="bg-black/30 border-[color:var(--border-subtle)]"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <label className="flex items-center gap-2 text-sm text-white/70">
              <Checkbox checked={dryRun} onCheckedChange={(v) => setDryRun(v === true)} />
              Dry run (no writes)
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <Checkbox
                checked={sendActivationEmails}
                onCheckedChange={(v) => setSendActivationEmails(v === true)}
              />
              Send activation emails (requires email config)
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <Checkbox
                checked={includeActivationLinks}
                onCheckedChange={(v) => setIncludeActivationLinks(v === true)}
              />
              Include activation links in response (sensitive)
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <Checkbox
                checked={createPublicProfiles}
                onCheckedChange={(v) => setCreatePublicProfiles(v === true)}
              />
              Create public profiles for owner-email rows
            </label>
          </div>

          {includeActivationLinks && (
            <div className="flex items-start gap-2 rounded border border-ts-orange/30 bg-ts-orange/10 p-3 text-xs text-ts-orange">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                Activation links contain one-time tokens. Only enable this if you need to manually
                send links and you understand the risk.
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[color:var(--border-subtle)] bg-black/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">County enrichment (routing)</div>
                <div className="text-xs text-[color:var(--text-secondary)]">
                  Assign counties to unclaimed businesses using stored address fields so Scout can
                  route by county. Safe to run repeatedly.
                </div>
              </div>
              <Button
                onClick={() => enrichMutation.mutate()}
                disabled={enrichMutation.isPending}
                variant="outline"
                className="border-[color:var(--border-subtle)]"
              >
                {enrichMutation.isPending
                  ? "Enriching..."
                  : enrichDryRun
                    ? "Dry Run"
                    : "Enrich Counties"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/60">Limit</label>
                <Input
                  value={enrichLimit}
                  onChange={(e) => setEnrichLimit(e.target.value)}
                  placeholder="100"
                  className="bg-black/30 border-[color:var(--border-subtle)]"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <Checkbox
                    checked={enrichDryRun}
                    onCheckedChange={(v) => setEnrichDryRun(v === true)}
                  />
                  Dry run (no writes)
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/60">Paste CSV/TSV/text</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Headers supported (recommended):\nemail,business_name,county_fips,state_code,phone,website,category,services,owner_first_name,owner_last_name\n\nServices can be separated by ';' or '|'.`}
              rows={10}
              className="bg-black/30 border-[color:var(--border-subtle)] text-white"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader>
          <CardTitle className="text-white">Recent Import Batches</CardTitle>
          <CardDescription className="text-[color:var(--text-secondary)]">
            Review staged rows before or after merge. This is admin-only visibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60">Batch</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full h-10 rounded-md border border-[color:var(--border-subtle)] bg-black/30 px-3 text-sm text-white"
              >
                <option value="">Latest batch</option>
                {batches.map((batch) => (
                  <option key={batch.batchId} value={batch.batchId}>
                    {batch.batchId} - {batch.source} ({batch.totalRows})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/60">Status filter</label>
              <select
                value={selectedBatchStatus}
                onChange={(e) => setSelectedBatchStatus(e.target.value)}
                className="w-full h-10 rounded-md border border-[color:var(--border-subtle)] bg-black/30 px-3 text-sm text-white"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="merged">Merged</option>
                <option value="failed">Failed</option>
                <option value="skipped_duplicate">Skipped duplicate</option>
              </select>
            </div>
          </div>

          {batchesLoading ? (
            <div className="text-xs text-white/60">Loading batches...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {batches.slice(0, 8).map((batch) => (
                <button
                  type="button"
                  key={`${batch.batchId}-${batch.source}`}
                  onClick={() => setSelectedBatchId(batch.batchId)}
                  className="text-left rounded border border-[color:var(--border-subtle)] bg-black/30 p-2 text-xs text-white/70 hover:border-ts-orange/30"
                >
                  <div className="font-medium text-white">
                    {batch.batchId} - {batch.source}
                  </div>
                  <div className="mt-1 text-white/70">
                    Total {batch.totalRows}, Pending {batch.pendingRows}, Merged {batch.mergedRows},
                    Failed {batch.failedRows}
                  </div>
                </button>
              ))}
            </div>
          )}

          {batchRowsLoading ? (
            <div className="text-xs text-white/60">Loading staged rows...</div>
          ) : batchRows.length > 0 ? (
            <div className="space-y-2">
              {batchRows.slice(0, 40).map((row) => (
                <div
                  key={row.id}
                  className="rounded border border-[color:var(--border-subtle)] bg-black/30 p-3 text-xs text-white/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate">
                      {row.name} {row.email ? `(${row.email})` : ""}
                    </div>
                    <div className="text-white/70">{row.status}</div>
                  </div>
                  <div className="mt-1 text-white/60">
                    {row.stateCode || "--"} / {row.countyFips || "--"}{" "}
                    {row.phone ? `- ${row.phone}` : ""}
                  </div>
                  {row.mergeNotes ? (
                    <div className="mt-1 text-amber-200">{row.mergeNotes}</div>
                  ) : null}
                </div>
              ))}
              {batchRows.length > 40 ? (
                <div className="text-xs text-white/60">Showing first 40 rows.</div>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-white/60">No staged rows found for this batch.</div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardHeader>
            <CardTitle className="text-white">Import Results</CardTitle>
            <CardDescription className="text-[color:var(--text-secondary)]">
              OK: {okCount} - Errors: {errorCount} - Delimiter: {result.delimiter}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.activationLinkExport?.requested &&
            result.activationLinkExport.allowed === false ? (
              <div className="text-xs text-ts-orange">
                {result.activationLinkExport.reason || "Activation link export not allowed."}
              </div>
            ) : null}
            <div className="text-xs text-white/70 bg-black/30 rounded border border-[color:var(--border-subtle)] p-3">
              <div>Rows: {result.totals.rows}</div>
              <div>Users created: {result.totals.createdUsers}</div>
              <div>Users updated: {result.totals.updatedUsers}</div>
              <div>Businesses created: {result.totals.createdBusinesses}</div>
              <div>Businesses matched: {result.totals.updatedBusinesses}</div>
              {typeof result.totals.createdUnclaimedBusinesses === "number" ? (
                <div>Unclaimed businesses created: {result.totals.createdUnclaimedBusinesses}</div>
              ) : null}
              {typeof result.totals.updatedUnclaimedBusinesses === "number" ? (
                <div>Unclaimed businesses matched: {result.totals.updatedUnclaimedBusinesses}</div>
              ) : null}
              {typeof result.totals.createdPublicProfiles === "number" ? (
                <div>Public profiles created: {result.totals.createdPublicProfiles}</div>
              ) : null}
              <div>Activation prepared: {result.totals.activationPrepared}</div>
              <div>Activation emailed: {result.totals.activationEmailed}</div>
            </div>

            <div className="space-y-2">
              {(result.results || []).slice(0, 50).map((r) => (
                <div
                  key={`${r.row}-${r.email}`}
                  className="rounded border border-[color:var(--border-subtle)] bg-black/30 p-3 text-xs text-white/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate">
                      Row {r.row}: {r.businessName} ({r.email})
                    </div>
                    <div
                      className={
                        r.status === "error"
                          ? "text-red-300"
                          : r.status === "dry_run"
                            ? "text-amber-200"
                            : "text-emerald-200"
                      }
                    >
                      {r.status}
                    </div>
                  </div>
                  {r.error ? <div className="text-red-300 mt-1">{r.error}</div> : null}
                  {r.profileSlug ? (
                    <div className="mt-1">
                      Profile: <span className="text-ts-orange">/business/{r.profileSlug}</span>
                    </div>
                  ) : null}
                  {r.publicProfileSlug ? (
                    <div className="mt-1">
                      Public profile slug:{" "}
                      <span className="text-emerald-200">{r.publicProfileSlug}</span>
                    </div>
                  ) : null}
                  {r.activationLink ? (
                    <div className="mt-1 break-all">
                      Activation: <span className="text-ts-orange">{r.activationLink}</span>
                    </div>
                  ) : null}
                </div>
              ))}
              {result.results.length > 50 ? (
                <div className="text-xs text-white/60">Showing first 50 rows.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
