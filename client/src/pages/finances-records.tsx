import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { useToast } from "@/hooks/use-toast";
import { Page } from "@/components/layout/PagePrimitives";

type AccountingRecordType = "BILL" | "PURCHASE_ORDER" | "CREDIT_NOTE" | "PAYMENT" | "JOURNAL_ENTRY";

interface AccountingRecord {
  id: string;
  job_id: string | null;
  type: string;
  status: string;
  payload: any;
  created_at: string;
  updated_at: string;
}

interface AccountingRecordsResponse {
  records: AccountingRecord[];
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    pageCount: number;
  };
}

export default function FinancesRecordsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();

  const initialJobIdFromQuery = (() => {
    const idx = location.indexOf("?");
    if (idx === -1) return "";
    const params = new URLSearchParams(location.slice(idx + 1));
    return params.get("jobId") || "";
  })();

  const [recordType, setRecordType] = useState<AccountingRecordType>("BILL");
  const [title, setTitle] = useState("");
  const [jobId, setJobId] = useState(initialJobIdFromQuery);
  const [clientName, setClientName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [reference, setReference] = useState("");
  const [total, setTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | AccountingRecordType>("ALL");

  const { data, isLoading } = useQuery<AccountingRecordsResponse>({
    queryKey: ["/api/accounting/records", filterType],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "200" });
      if (filterType !== "ALL") params.set("type", filterType);
      const res = await fetch(`/api/accounting/records?${params.toString()}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load records (${res.status})`);
      }
      return (await res.json()) as AccountingRecordsResponse;
    },
  });

  const createRecord = useMutation({
    mutationFn: async () => {
      const numericTotal = Number(total || 0);
      if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
        throw new Error("Enter a valid total greater than zero.");
      }

      const res = await fetch("/api/accounting/standalone-record", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          type: recordType,
          projectTitle: title || undefined,
          jobId: jobId.trim() || undefined,
          clientName: clientName || undefined,
          vendorName: vendorName || undefined,
          reference: reference || undefined,
          total: numericTotal,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to create record (${res.status})`);
      }
      return (await res.json()) as { document: AccountingRecord };
    },
    onSuccess: (result) => {
      toast({
        title: `${result.document.type.replace(/_/g, " ")} recorded`,
        description: "Saved to your finance ledger and available in reports.",
      });
      setTitle("");
      setClientName("");
      setVendorName("");
      setReference("");
      setTotal("");
      setNotes("");
      setJobId("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/job-flows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/reports/summary"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not create record",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const records = data?.records ?? [];

  const groupedCounts = useMemo(() => {
    return records.reduce<Record<string, number>>((acc, row) => {
      const key = String(row.type || "").toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [records]);

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "-";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  return (
    <Page className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">Records</h1>
          <p className="text-sm text-white/60">
            Unified bookkeeping ledger for bills, POs, credits, payments, and journal entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-white/15 text-[11px] text-white/70"
            onClick={() => navigate("/finances/reports")}
          >
            Open reports
          </Button>
        </div>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">Create record</CardTitle>
          <CardDescription className="text-xs text-white/60">
            Create at any stage and optionally link to an existing accounting job flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <select
              value={recordType}
              onChange={(e) => setRecordType(e.target.value as AccountingRecordType)}
              className="h-11 rounded-md bg-tsCard border border-white/10 px-3 text-tsText text-sm"
            >
              <option value="BILL">Bill</option>
              <option value="PURCHASE_ORDER">Purchase order</option>
              <option value="CREDIT_NOTE">Credit note</option>
              <option value="PAYMENT">Payment</option>
              <option value="JOURNAL_ENTRY">Journal entry</option>
            </select>
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Link job ID (optional)"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Total"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              placeholder="Client (optional)"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Vendor (optional)"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Reference (optional)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
          </div>
          <Input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => createRecord.mutate()}
              disabled={createRecord.isPending}
            >
              {createRecord.isPending ? "Creating..." : "Create record"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-tsCard border-white/10">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-white">Ledger</CardTitle>
            <CardDescription className="text-xs text-white/60">
              Complete records history across supported bookkeeping record types.
            </CardDescription>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "ALL" | AccountingRecordType)}
            className="h-8 rounded-md bg-tsCard border border-white/10 px-2 text-[11px] text-tsText"
          >
            <option value="ALL">All record types</option>
            <option value="BILL">Bills</option>
            <option value="PURCHASE_ORDER">Purchase orders</option>
            <option value="CREDIT_NOTE">Credit notes</option>
            <option value="PAYMENT">Payments</option>
            <option value="JOURNAL_ENTRY">Journal entries</option>
          </select>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-[11px] text-white/60">
            Bills: {groupedCounts.BILL || 0} · Purchase orders: {groupedCounts.PURCHASE_ORDER || 0}·
            Credit notes: {groupedCounts.CREDIT_NOTE || 0} · Payments: {groupedCounts.PAYMENT || 0}·
            Journal entries: {groupedCounts.JOURNAL_ENTRY || 0}
          </div>
          {isLoading ? (
            <p className="text-[11px] text-white/60">Loading records...</p>
          ) : records.length === 0 ? (
            <p className="text-[11px] text-white/60">No records found for this filter yet.</p>
          ) : (
            <div className="space-y-2">
              {records.map((record) => {
                const payload = record.payload || {};
                const titleText =
                  (typeof payload.projectTitle === "string" && payload.projectTitle) ||
                  (typeof payload.title === "string" && payload.title) ||
                  `${record.type} ${record.id.slice(0, 8)}`;
                const totalVal = typeof payload.total === "number" ? payload.total : null;

                return (
                  <div
                    key={record.id}
                    className="rounded-md border border-white/10 bg-tsCard/90 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{titleText}</p>
                        <p className="text-[11px] text-white/60">
                          {record.type.replace(/_/g, " ")} · {record.status}
                          {record.job_id ? ` · ${record.job_id}` : " · standalone"}
                        </p>
                        <p className="text-[11px] text-white/50 mt-0.5">
                          Updated {new Date(record.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-sky-400">
                        {totalVal !== null ? formatCurrency(totalVal) : "-"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
