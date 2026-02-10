import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
    activationLink?: string;
  }>;
};

export default function AdminBusinessImport() {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [sendActivationEmails, setSendActivationEmails] = useState(false);
  const [includeActivationLinks, setIncludeActivationLinks] = useState(false);
  const [defaultCountyFips, setDefaultCountyFips] = useState("");
  const [defaultStateCode, setDefaultStateCode] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/businesses/import", {
        content,
        dryRun,
        sendActivationEmails,
        includeActivationLinks,
        defaultCountyFips: defaultCountyFips.trim() || undefined,
        defaultStateCode: defaultStateCode.trim() || undefined,
      });
      return res as ImportResponse;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Import complete",
        description: `Rows: ${data.totals.rows} - Users created: ${data.totals.createdUsers} - Businesses created: ${data.totals.createdBusinesses}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error?.message || "Failed to import",
        variant: "destructive",
      });
    },
  });

  const onFileSelected = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setContent(text);
    toast({ title: "Loaded file", description: file.name });
  };

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
            <Building2 className="h-5 w-5 text-orange-400" />
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
              <label className="text-xs text-slate-400">Upload file</label>
              <Input
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
                className="bg-slate-950/40 border-[color:var(--border-subtle)]"
              />
            </div>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || !content.trim()}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Upload className="h-4 w-4 mr-2" />
              {importMutation.isPending ? "Importing..." : dryRun ? "Dry Run" : "Import"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Default county FIPS (optional)</label>
              <Input
                value={defaultCountyFips}
                onChange={(e) => setDefaultCountyFips(e.target.value)}
                placeholder="e.g., 48201"
                className="bg-slate-950/40 border-[color:var(--border-subtle)]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Default state code (optional)</label>
              <Input
                value={defaultStateCode}
                onChange={(e) => setDefaultStateCode(e.target.value)}
                placeholder="e.g., TX"
                className="bg-slate-950/40 border-[color:var(--border-subtle)]"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <Checkbox checked={dryRun} onCheckedChange={(v) => setDryRun(v === true)} />
              Dry run (no writes)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <Checkbox
                checked={sendActivationEmails}
                onCheckedChange={(v) => setSendActivationEmails(v === true)}
              />
              Send activation emails (requires email config)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <Checkbox
                checked={includeActivationLinks}
                onCheckedChange={(v) => setIncludeActivationLinks(v === true)}
              />
              Include activation links in response (sensitive)
            </label>
          </div>

          {includeActivationLinks && (
            <div className="flex items-start gap-2 rounded border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-100">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                Activation links contain one-time tokens. Only enable this if you need to manually
                send links and you understand the risk.
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400">Paste CSV/TSV/text</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Headers supported (recommended):\nemail,business_name,county_fips,state_code,phone,website,category,services,owner_first_name,owner_last_name\n\nServices can be separated by ';' or '|'.`}
              rows={10}
              className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
            />
          </div>
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
              <div className="text-xs text-orange-200">
                {result.activationLinkExport.reason || "Activation link export not allowed."}
              </div>
            ) : null}
            <div className="text-xs text-slate-200 bg-slate-950/40 rounded border border-[color:var(--border-subtle)] p-3">
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
              <div>Activation prepared: {result.totals.activationPrepared}</div>
              <div>Activation emailed: {result.totals.activationEmailed}</div>
            </div>

            <div className="space-y-2">
              {(result.results || []).slice(0, 50).map((r) => (
                <div
                  key={`${r.row}-${r.email}`}
                  className="rounded border border-[color:var(--border-subtle)] bg-slate-950/30 p-3 text-xs text-slate-200"
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
                      Profile: <span className="text-orange-200">/business/{r.profileSlug}</span>
                    </div>
                  ) : null}
                  {r.activationLink ? (
                    <div className="mt-1 break-all">
                      Activation: <span className="text-orange-200">{r.activationLink}</span>
                    </div>
                  ) : null}
                </div>
              ))}
              {result.results.length > 50 ? (
                <div className="text-xs text-slate-400">Showing first 50 rows.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
