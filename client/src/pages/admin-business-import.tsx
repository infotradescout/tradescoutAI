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
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type ImportResponse = {
  dryRun: boolean;
  delimiter: "comma" | "tab" | "pipe";
  parse?: {
    looksLikeHeader: boolean;
    headers: string[];
    delimiter: string;
  } | null;
  warnings?: string[];
  postCommit?: {
    claimWriteWarnings: number;
    batchAuditWarning?: {
      code: string;
      message: string;
      retryRequired: true;
    } | null;
  };
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
    postCommitClaimWarnings?: number;
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
    activationEmailWarning?: string;
    claimWarning?: {
      code: string;
      message: string;
      retryRequired: true;
    } | null;
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

type ImportedDirectoryUserCandidate = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  role?: string | null;
  roles?: string[] | null;
  onboardingCompleted?: boolean | null;
  emailVerified?: boolean | null;
  activeBusinessId?: string | null;
  activeProfileId?: string | null;
  businessSlug?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  ownedBusinessId?: string | null;
  ownedBusinessSlug?: string | null;
};

type ExternalImportProvider = "google_maps_places" | "facebook_graph_pages";

type ExternalImportPreview = {
  provider: ExternalImportProvider;
  totals?: { rows?: number };
  warnings?: string[];
  csv: string;
  rows?: Array<Record<string, string>>;
};

// Large imports are uploaded in multiple requests to avoid per-request payload limits (413).
// There is no cap on total rows; we just split into parts.
//
// In production, JSON bodies default to 1mb; this page uses text/plain uploads (see server route),
// so we can safely use a larger chunk target while staying well below server text limits.
const CHUNK_TARGET_CHARS = 2_000_000;

function looksLikeHeaderLine(line: string): boolean {
  const normalized = String(line || "").toLowerCase();
  return ["email", "business", "company", "phone", "county", "fips", "state"].some((k) =>
    normalized.includes(k)
  );
}

function splitIntoImportChunks(raw: string): { chunks: string[]; estimatedRows: number } {
  const normalized = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
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

  const estimatedRows = Math.max(
    0,
    dataLines.filter((l) => String(l || "").trim().length > 0).length
  );
  return { chunks: chunks.filter((c) => c.trim().length > 0), estimatedRows };
}

export default function AdminBusinessImport() {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [source, setSource] = useState("csv_manual");
  const [dryRun, setDryRun] = useState(false);
  const [createOwnerAccounts, setCreateOwnerAccounts] = useState(false);
  const [confirmCreateUsers, setConfirmCreateUsers] = useState("");
  const [realAccountImportReason, setRealAccountImportReason] = useState("");
  const [sendActivationEmails, setSendActivationEmails] = useState(false);
  const [includeActivationLinks, setIncludeActivationLinks] = useState(false);
  const [createPublicProfiles, setCreatePublicProfiles] = useState(false);
  const [defaultCountyFips, setDefaultCountyFips] = useState("");
  const [defaultStateCode, setDefaultStateCode] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedBatchStatus, setSelectedBatchStatus] = useState("all");
  const [batchRowLimit, setBatchRowLimit] = useState("200");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [enrichLimit, setEnrichLimit] = useState("100");
  const [enrichDryRun, setEnrichDryRun] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [loadedFileMeta, setLoadedFileMeta] = useState<{ name: string; sizeBytes: number } | null>(
    null
  );
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [externalProvider, setExternalProvider] =
    useState<ExternalImportProvider>("google_maps_places");
  const [externalQuery, setExternalQuery] = useState("");
  const [externalLocation, setExternalLocation] = useState("");
  const [externalLimit, setExternalLimit] = useState("25");
  const [externalFacebookToken, setExternalFacebookToken] = useState("");
  const [externalPreview, setExternalPreview] = useState<ExternalImportPreview | null>(null);

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
    data: cleanupUsersData,
    isLoading: cleanupUsersLoading,
    refetch: refetchCleanupUsers,
  } = useQuery({
    queryKey: ["/api/admin/imported-directory-users"],
    queryFn: async () =>
      ((await apiRequest("GET", "/api/admin/imported-directory-users?limit=2000")) as {
        users?: ImportedDirectoryUserCandidate[];
      }) || { users: [] },
    retry: false,
  });
  const cleanupUsers = cleanupUsersData?.users || [];
  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const bulkConfirmOk = bulkArchiveConfirm.trim() === "ARCHIVE_ALL";
  const archiveReasonOk = archiveReason.trim().length >= 12 && archiveReason.trim().length <= 500;
  const [bulkArchiving, setBulkArchiving] = useState<{
    running: boolean;
    done: number;
    total: number;
  }>({ running: false, done: 0, total: 0 });
  const [archivingCleanupUserId, setArchivingCleanupUserId] = useState<string | null>(null);
  const [optimisticallyArchivedCleanupUsers, setOptimisticallyArchivedCleanupUsers] = useState<
    Record<string, true>
  >({});
  const visibleCleanupUsers = cleanupUsers.filter((u) => !optimisticallyArchivedCleanupUsers[u.id]);

  const archiveCleanupUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!archiveReasonOk) {
        throw new Error("Archiving requires a 12-500 character audit reason.");
      }
      return apiRequest(
        "POST",
        `/api/admin/imported-directory-users/${encodeURIComponent(userId)}/archive-to-directory`,
        {
          reason: archiveReason.trim(),
          confirm: "ARCHIVE_IMPORTED_DIRECTORY_USER",
        }
      );
    },
    onMutate: (userId: string) => {
      setArchivingCleanupUserId(userId);
    },
    onSuccess: (data: any, userId: string) => {
      setOptimisticallyArchivedCleanupUsers((prev) => ({ ...prev, [userId]: true }));
      const alreadyArchived = data?.alreadyArchived === true;
      const archiveTarget = data?.directoryBusinessSlug || data?.directoryBusinessId || "";
      toast({
        title: alreadyArchived ? "Already archived" : "Archived",
        description: alreadyArchived
          ? `User was already archived in prior cleanup${archiveTarget ? ` (${archiveTarget})` : ""}.`
          : `Archived user and preserved directory business: ${archiveTarget}`,
      });
      void refetchCleanupUsers();
    },
    onError: (error: any, userId: string) => {
      setOptimisticallyArchivedCleanupUsers((prev) => {
        if (!prev[userId]) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      toast({
        title: "Archive failed",
        description: formatUserFacingErrorMessage(error, "Failed to archive user"),
        variant: "destructive",
      });
    },
    onSettled: () => {
      setArchivingCleanupUserId(null);
    },
  });

  const bulkArchiveImportedUsers = async (userIds: string[]) => {
    if (bulkArchiving.running) return;
    const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
    if (ids.length === 0) return;

    if (bulkArchiveConfirm.trim() !== "ARCHIVE_ALL") {
      toast({
        title: "Confirmation required",
        description: 'Type "ARCHIVE_ALL" to bulk-archive imported users.',
        variant: "destructive",
      });
      return;
    }
    if (!archiveReasonOk) {
      toast({
        title: "Audit reason required",
        description: "Enter a 12-500 character reason before archiving.",
        variant: "destructive",
      });
      return;
    }

    setBulkArchiving({ running: true, done: 0, total: ids.length });
    let done = 0;
    try {
      for (const userId of ids) {
        await apiRequest(
          "POST",
          `/api/admin/imported-directory-users/${encodeURIComponent(userId)}/archive-to-directory`,
          {
            reason: archiveReason.trim(),
            confirm: "ARCHIVE_IMPORTED_DIRECTORY_USER",
          }
        );
        setOptimisticallyArchivedCleanupUsers((prev) => ({ ...prev, [userId]: true }));
        done += 1;
        setBulkArchiving({ running: true, done, total: ids.length });
      }
      toast({
        title: "Bulk archive complete",
        description: `Archived ${done} users into unclaimed directory businesses.`,
      });
      setBulkArchiveConfirm("");
      void refetchCleanupUsers();
    } catch (error: any) {
      toast({
        title: "Bulk archive failed",
        description: formatUserFacingErrorMessage(error, "Failed while archiving users."),
        variant: "destructive",
      });
      void refetchCleanupUsers();
    } finally {
      setBulkArchiving((prev) => ({ ...prev, running: false }));
    }
  };

  const bulkArchiveAllMutation = useMutation({
    mutationFn: async () => {
      if (bulkArchiveConfirm.trim() !== "ARCHIVE_ALL") {
        throw new Error('Type "ARCHIVE_ALL" to bulk-archive imported users.');
      }
      if (!archiveReasonOk) {
        throw new Error("Archiving requires a 12-500 character audit reason.");
      }
      return apiRequest("POST", "/api/admin/imported-directory-users/archive-all", {
        confirm: bulkArchiveConfirm.trim(),
        reason: archiveReason.trim(),
        limit: 5000,
      });
    },
    onSuccess: (data: any) => {
      // Best-effort: immediately hide the currently visible candidates while the refetch loads.
      setOptimisticallyArchivedCleanupUsers((prev) => {
        const next = { ...prev };
        for (const u of visibleCleanupUsers) next[u.id] = true;
        return next;
      });
      toast({
        title: "Bulk archive complete",
        description: `Archived ${data?.archived ?? 0}/${data?.matched ?? 0} users into directory businesses.`,
      });
      setBulkArchiveConfirm("");
      void refetchCleanupUsers();
    },
    onError: (error: any) => {
      toast({
        title: "Bulk archive failed",
        description: formatUserFacingErrorMessage(error, "Failed to bulk-archive users"),
        variant: "destructive",
      });
    },
  });

  const {
    data: batchRowsData,
    isLoading: batchRowsLoading,
    refetch: refetchBatchRows,
  } = useQuery({
    queryKey: ["/api/admin/businesses/import/batches", effectiveBatchId, selectedBatchStatus],
    enabled: Boolean(effectiveBatchId),
    queryFn: async () => {
      const params = new URLSearchParams();
      const parsed = typeof batchRowLimit === "string" ? parseInt(batchRowLimit || "200", 10) : 200;
      const clamped = Number.isFinite(parsed) ? Math.max(1, Math.min(500, parsed)) : 200;
      params.set("limit", String(clamped));
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
      if (createOwnerAccounts && confirmCreateUsers.trim() !== "CREATE_USERS") {
        throw new Error("To create real user accounts, type CREATE_USERS in the confirmation box.");
      }
      if (
        createOwnerAccounts &&
        (realAccountImportReason.trim().length < 12 || realAccountImportReason.trim().length > 500)
      ) {
        throw new Error("Real account creation requires a 12-500 character audit reason.");
      }

      const params = new URLSearchParams();
      params.set("source", source.trim() || "csv_manual");
      if (dryRun) params.set("dryRun", "true");
      if (createOwnerAccounts) params.set("createOwnerAccounts", "true");
      if (createOwnerAccounts) params.set("confirmCreateUsers", confirmCreateUsers.trim());
      if (createOwnerAccounts) params.set("reason", realAccountImportReason.trim());
      if (sendActivationEmails) params.set("sendActivationEmails", "true");
      if (includeActivationLinks) params.set("includeActivationLinks", "true");
      if (createPublicProfiles) params.set("createPublicProfiles", "true");
      if (defaultCountyFips.trim()) params.set("defaultCountyFips", defaultCountyFips.trim());
      if (defaultStateCode.trim()) params.set("defaultStateCode", defaultStateCode.trim());

      const importUrl = `/api/admin/businesses/import?${params.toString()}`;

      if (uploadFile) {
        const form = new FormData();
        form.append("file", uploadFile);
        const res = await apiRequest(importUrl, {
          method: "POST",
          timeoutMs: 300_000,
          body: form,
        });
        return res as ImportResponse;
      }

      const { chunks, estimatedRows } = splitIntoImportChunks(content);
      if (chunks.length <= 1) {
        const res = await apiRequest(importUrl, {
          method: "POST",
          timeoutMs: 120_000,
          body: content,
        });
        return res as ImportResponse;
      }

      // Chunked upload to avoid 413 payload limits in production.
      const combined: ImportResponse = {
        dryRun,
        delimiter: "comma",
        warnings: [],
        postCommit: {
          claimWriteWarnings: 0,
          batchAuditWarning: null,
        },
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
          postCommitClaimWarnings: 0,
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

        let res: ImportResponse;
        try {
          res = (await apiRequest(importUrl, {
            method: "POST",
            timeoutMs: 120_000,
            body: chunks[i],
          })) as ImportResponse;
        } catch (err: any) {
          throw new Error(
            `Import failed on chunk ${i + 1}/${chunks.length}: ${err?.message || "unknown error"}`
          );
        }

        combined.delimiter = res.delimiter;
        combined.activationLinkExport = res.activationLinkExport;
        combined.warnings = Array.from(
          new Set([...(combined.warnings || []), ...(res.warnings || [])])
        );
        if (combined.postCommit) {
          combined.postCommit.claimWriteWarnings += res.postCommit?.claimWriteWarnings || 0;
          combined.postCommit.batchAuditWarning =
            res.postCommit?.batchAuditWarning || combined.postCommit.batchAuditWarning || null;
        }
        combined.totals.rows += res.totals.rows;
        combined.totals.createdUsers += res.totals.createdUsers;
        combined.totals.updatedUsers += res.totals.updatedUsers;
        combined.totals.createdBusinesses += res.totals.createdBusinesses;
        combined.totals.updatedBusinesses += res.totals.updatedBusinesses;
        combined.totals.createdUnclaimedBusinesses =
          (combined.totals.createdUnclaimedBusinesses || 0) +
          (res.totals.createdUnclaimedBusinesses || 0);
        combined.totals.updatedUnclaimedBusinesses =
          (combined.totals.updatedUnclaimedBusinesses || 0) +
          (res.totals.updatedUnclaimedBusinesses || 0);
        combined.totals.createdPublicProfiles =
          (combined.totals.createdPublicProfiles || 0) + (res.totals.createdPublicProfiles || 0);
        combined.totals.activationPrepared += res.totals.activationPrepared;
        combined.totals.activationEmailed += res.totals.activationEmailed;
        combined.totals.postCommitClaimWarnings =
          (combined.totals.postCommitClaimWarnings || 0) +
          (res.totals.postCommitClaimWarnings || 0);

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
        description: formatUserFacingErrorMessage(error, "Failed to import"),
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
        description: formatUserFacingErrorMessage(error, "Failed to enrich counties"),
        variant: "destructive",
      });
    },
  });

  const externalSearchMutation = useMutation({
    mutationFn: async () => {
      if (!externalQuery.trim()) {
        throw new Error("External query is required.");
      }
      const parsedLimit = Number.parseInt(externalLimit, 10);
      return (await apiRequest("/api/admin/businesses/import/external-search", {
        method: "POST",
        timeoutMs: 60_000,
        body: {
          provider: externalProvider,
          query: externalQuery.trim(),
          location: externalLocation.trim(),
          limit: Number.isFinite(parsedLimit) ? parsedLimit : 25,
          defaultCountyFips: defaultCountyFips.trim(),
          defaultStateCode: defaultStateCode.trim(),
          facebookAccessToken: externalFacebookToken.trim(),
        },
      })) as ExternalImportPreview;
    },
    onSuccess: (data) => {
      setExternalPreview(data);
      toast({
        title: "External preview ready",
        description: `Fetched ${data?.totals?.rows ?? 0} candidate businesses from ${data.provider}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "External search failed",
        description: formatUserFacingErrorMessage(error, "Failed to fetch external businesses"),
        variant: "destructive",
      });
    },
  });

  const useExternalPreviewAsImportPayload = () => {
    const csv = externalPreview?.csv || "";
    if (!csv.trim()) {
      toast({
        title: "No preview loaded",
        description: "Run external search first, then load results into import payload.",
        variant: "destructive",
      });
      return;
    }

    setUploadFile(null);
    setLoadedFileMeta(null);
    setContent(csv);
    setSource(externalProvider);
    toast({
      title: "Preview loaded",
      description: "External results were loaded into the import payload editor.",
    });
  };

  const onFileSelected = async (file: File | null) => {
    if (!file) return;
    const name = String(file.name || "").toLowerCase();
    if (name.endsWith(".xlsx")) {
      setUploadFile(file);
      setContent("");
    } else {
      const text = await file.text();
      setUploadFile(null);
      setContent(text);
    }
    setLoadedFileMeta({ name: file.name, sizeBytes: file.size });
    toast({ title: "Loaded file", description: file.name });
  };

  const chunkPreview = useMemo(() => {
    if (uploadFile) return { chunks: 1, estimatedRows: null as any };
    if (!content.trim()) return null;
    const { chunks, estimatedRows } = splitIntoImportChunks(content);
    return { chunks: chunks.length, estimatedRows };
  }, [content, uploadFile]);

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
            Upload CSV/TSV/XLSX to create claimable business directory entries and (optionally)
            pre-create business owner accounts. Imported businesses still must finish their profile
            and pass verification. Phone numbers are imported when present.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1">
              <label className="text-xs text-white/60">Upload file</label>
              <Input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
                className="bg-black/30 border-[color:var(--border-subtle)]"
              />
            </div>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || (!content.trim() && !uploadFile)}
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
              {uploadFile ? (
                <>Excel upload (all sheets will be imported in one request).</>
              ) : (
                <>
                  Estimated rows:{" "}
                  <span className="text-white/70">{chunkPreview.estimatedRows}</span>. This import
                  will upload in <span className="text-white/70">{chunkPreview.chunks}</span> parts
                  to avoid per-request payload limits. No row cap.
                </>
              )}
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

          <div className="rounded-xl border border-[color:var(--border-subtle)] bg-black/30 p-4 space-y-3">
            <div>
              <div className="text-sm font-semibold text-white">
                External Source Import (TradeScout)
              </div>
              <div className="text-xs text-[color:var(--text-secondary)]">
                Fetch candidate businesses from Google Maps Places or Facebook Graph, review them,
                then load as CSV into this admin import flow.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">Provider</label>
                <select
                  value={externalProvider}
                  onChange={(e) => setExternalProvider(e.target.value as ExternalImportProvider)}
                  className="w-full h-10 rounded-md border border-[color:var(--border-subtle)] bg-black/30 px-3 text-sm text-white"
                >
                  <option value="google_maps_places">Google Maps Places</option>
                  <option value="facebook_graph_pages">Facebook Graph Pages</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/60">Query</label>
                <Input
                  value={externalQuery}
                  onChange={(e) => setExternalQuery(e.target.value)}
                  placeholder="e.g., plumbers in houston"
                  className="bg-black/30 border-[color:var(--border-subtle)]"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Location bias (lat,lng optional)</label>
                <Input
                  value={externalLocation}
                  onChange={(e) => setExternalLocation(e.target.value)}
                  placeholder="e.g., 29.7604,-95.3698"
                  className="bg-black/30 border-[color:var(--border-subtle)]"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Result limit (1-100)</label>
                <Input
                  value={externalLimit}
                  onChange={(e) => setExternalLimit(e.target.value)}
                  placeholder="25"
                  className="bg-black/30 border-[color:var(--border-subtle)]"
                />
              </div>
              {externalProvider === "facebook_graph_pages" ? (
                <div className="md:col-span-2">
                  <label className="text-xs text-white/60">Facebook access token (optional)</label>
                  <Input
                    value={externalFacebookToken}
                    onChange={(e) => setExternalFacebookToken(e.target.value)}
                    placeholder="If empty, server uses TRADESCOUT_FACEBOOK_GRAPH_TOKEN"
                    className="bg-black/30 border-[color:var(--border-subtle)]"
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-col md:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-[color:var(--border-subtle)]"
                onClick={() => externalSearchMutation.mutate()}
                disabled={externalSearchMutation.isPending}
              >
                {externalSearchMutation.isPending ? "Fetching..." : "Fetch external preview"}
              </Button>
              <Button
                type="button"
                className="bg-ts-orange text-black hover:bg-ts-orange-dark"
                onClick={useExternalPreviewAsImportPayload}
                disabled={!externalPreview?.csv}
              >
                Load preview into import payload
              </Button>
            </div>

            {externalPreview ? (
              <div className="rounded border border-[color:var(--border-subtle)] bg-black/20 p-3 text-xs text-white/70 space-y-2">
                <div>
                  Provider: <span className="text-white/90">{externalPreview.provider}</span> -
                  Rows: <span className="text-white/90">{externalPreview?.totals?.rows ?? 0}</span>
                </div>
                {externalPreview.warnings && externalPreview.warnings.length > 0 ? (
                  <div className="text-ts-orange">{externalPreview.warnings.join(" | ")}</div>
                ) : null}
                <div>
                  CSV is generated with TradeScout admin import headers and does not auto-publish
                  contact access.
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <label className="flex items-center gap-2 text-sm text-white/70">
              <Checkbox checked={dryRun} onCheckedChange={(v) => setDryRun(v === true)} />
              Dry run (no writes)
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <Checkbox
                checked={createOwnerAccounts}
                onCheckedChange={(v) => {
                  const next = v === true;
                  setCreateOwnerAccounts(next);
                  if (!next) setConfirmCreateUsers("");
                  if (!next) setRealAccountImportReason("");
                  if (!next) {
                    setSendActivationEmails(false);
                    setIncludeActivationLinks(false);
                    setCreatePublicProfiles(false);
                  }
                }}
              />
              Create login accounts now (creates site users)
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <Checkbox
                checked={sendActivationEmails}
                disabled={!createOwnerAccounts}
                onCheckedChange={(v) => setSendActivationEmails(v === true)}
              />
              Send activation emails (requires email config)
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <Checkbox
                checked={includeActivationLinks}
                disabled={!createOwnerAccounts}
                onCheckedChange={(v) => setIncludeActivationLinks(v === true)}
              />
              Include activation links in response (sensitive)
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <Checkbox
                checked={createPublicProfiles}
                disabled={!createOwnerAccounts}
                onCheckedChange={(v) => setCreatePublicProfiles(v === true)}
              />
              Create public profiles for owner-email rows
            </label>
          </div>

          {createOwnerAccounts && (
            <div className="flex items-start gap-2 rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-white/80">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-200" />
              <div className="space-y-2">
                <div className="font-semibold text-red-200">Confirm user creation</div>
                <div className="text-white/70">
                  Type <span className="font-mono">CREATE_USERS</span> to confirm. This prevents
                  accidental imports creating real login accounts.
                </div>
                <Input
                  value={confirmCreateUsers}
                  onChange={(e) => setConfirmCreateUsers(e.target.value)}
                  placeholder="CREATE_USERS"
                  className="bg-black/30 border-red-500/30"
                />
                <Input
                  value={realAccountImportReason}
                  onChange={(e) => setRealAccountImportReason(e.target.value)}
                  placeholder="Audit reason (12-500 characters)"
                  className="bg-black/30 border-red-500/30"
                />
              </div>
            </div>
          )}

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
          <CardTitle className="text-white">Cleanup imported users (directory)</CardTitle>
          <CardDescription className="text-[color:var(--text-secondary)]">
            If you previously imported businesses as login accounts, this archives those accounts
            and keeps them as <span className="text-white">unclaimed directory businesses</span>{" "}
            until claimed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-white/60">
              Candidates: <span className="text-white">{visibleCleanupUsers.length}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-[color:var(--border-subtle)]"
              onClick={() => void refetchCleanupUsers()}
              disabled={cleanupUsersLoading}
            >
              Refresh
            </Button>
          </div>

          {visibleCleanupUsers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="text-xs text-white/60">
                  Bulk archive confirmation (type <span className="font-mono">ARCHIVE_ALL</span>)
                </label>
                <Input
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="Audit reason (12-500 characters)"
                  className={
                    archiveReasonOk
                      ? "mb-2 bg-black/30 border-emerald-500/40"
                      : "mb-2 bg-black/30 border-red-500/30"
                  }
                />
                <Input
                  value={bulkArchiveConfirm}
                  onChange={(e) => setBulkArchiveConfirm(e.target.value)}
                  placeholder="ARCHIVE_ALL"
                  className={
                    bulkConfirmOk
                      ? "bg-black/30 border-emerald-500/40"
                      : "bg-black/30 border-red-500/30"
                  }
                />
                <div
                  className={
                    bulkConfirmOk
                      ? "mt-1 text-[11px] text-emerald-300"
                      : "mt-1 text-[11px] text-red-300"
                  }
                >
                  {bulkConfirmOk
                    ? "Confirmed. Bulk archive actions enabled."
                    : 'Bulk archive is disabled until you type \"ARCHIVE_ALL\".'}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  className="bg-red-500 hover:bg-red-600 text-white"
                  disabled={
                    !bulkConfirmOk ||
                    !archiveReasonOk ||
                    cleanupUsersLoading ||
                    bulkArchiving.running ||
                    bulkArchiveAllMutation.isPending
                  }
                  onClick={() =>
                    void bulkArchiveImportedUsers(visibleCleanupUsers.slice(0, 25).map((u) => u.id))
                  }
                  title={
                    bulkConfirmOk
                      ? "Archives up to the first 25 candidates shown"
                      : 'Type \"ARCHIVE_ALL\" to enable bulk archive'
                  }
                >
                  {bulkArchiving.running
                    ? `Archiving ${bulkArchiving.done}/${bulkArchiving.total}...`
                    : "Archive 25 to directory"}
                </Button>
                <Button
                  type="button"
                  className="bg-red-700 hover:bg-red-800 text-white"
                  disabled={
                    !bulkConfirmOk ||
                    !archiveReasonOk ||
                    cleanupUsersLoading ||
                    bulkArchiving.running ||
                    bulkArchiveAllMutation.isPending
                  }
                  onClick={() => bulkArchiveAllMutation.mutate()}
                  title="Archives up to 5000 candidates server-side (requires ARCHIVE_ALL)"
                >
                  {bulkArchiveAllMutation.isPending ? "Archiving all..." : "Archive ALL (server)"}
                </Button>
              </div>
            </div>
          ) : null}

          {cleanupUsersLoading ? (
            <div className="text-xs text-white/60">Loading candidates...</div>
          ) : visibleCleanupUsers.length === 0 ? (
            <div className="text-xs text-white/60">
              No import-created business_owner accounts detected.
            </div>
          ) : (
            <div className="space-y-2">
              {visibleCleanupUsers.slice(0, 25).map((u) => {
                const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
                const isRowPending =
                  archiveCleanupUserMutation.isPending && archivingCleanupUserId === u.id;
                return (
                  <div
                    key={u.id}
                    className="rounded border border-[color:var(--border-subtle)] bg-black/30 p-3 text-xs text-white/70"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-white">
                          {u.email} {name ? `— ${name}` : ""}
                        </div>
                        <div className="mt-1 text-white/60">
                          Owned business:{" "}
                          <span className="text-white/80">
                            {u.ownedBusinessSlug || u.ownedBusinessId || "—"}
                          </span>
                          {u.createdAt
                            ? ` · Created ${new Date(u.createdAt).toLocaleString()}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          className="bg-ts-orange hover:bg-ts-orange-dark text-white"
                          disabled={isRowPending || !archiveReasonOk}
                          onClick={() => archiveCleanupUserMutation.mutate(u.id)}
                        >
                          {isRowPending ? "Archiving..." : "Archive to directory"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {visibleCleanupUsers.length > 25 ? (
                <div className="text-xs text-white/60">
                  Showing 25 of {visibleCleanupUsers.length}. Use Refresh after archiving.
                </div>
              ) : null}
            </div>
          )}

          <div className="rounded border border-ts-orange/30 bg-ts-orange/10 p-3 text-xs text-ts-orange">
            Archiving changes the user&apos;s email to an{" "}
            <span className="text-white">.invalid</span> address and preserves the real contact info
            on the directory business. This is admin-only and reversible only with manual database
            edits.
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            <div>
              <label className="text-xs text-white/60">Rows shown (max 500)</label>
              <Input
                value={batchRowLimit}
                onChange={(e) => setBatchRowLimit(e.target.value)}
                placeholder="200"
                className="bg-black/30 border-[color:var(--border-subtle)]"
              />
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
            {Array.isArray(result.warnings) && result.warnings.length > 0 ? (
              <div className="rounded border border-[color:var(--border-subtle)] bg-black/30 p-3 text-xs text-ts-orange">
                {result.warnings.map((w, idx) => (
                  <div key={idx}>{w}</div>
                ))}
              </div>
            ) : null}

            {result.parse && result.parse.looksLikeHeader === false ? (
              <div className="rounded border border-[color:var(--border-subtle)] bg-black/30 p-3 text-xs text-amber-200">
                Header row was not detected; the importer assumed default column order. If your file
                has headers like “Company Name” / “Business Email”, make sure the header row is
                included (row 1) so columns map correctly.
                {Array.isArray(result.parse.headers) && result.parse.headers.length ? (
                  <div className="mt-2 text-white/70">
                    Assumed headers:{" "}
                    <span className="font-mono">{result.parse.headers.join(", ")}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

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
