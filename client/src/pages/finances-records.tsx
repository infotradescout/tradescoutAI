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

interface AccountingAutomationEvent {
  id: string;
  sourceSurface: string;
  sourceType: string;
  sourceId: string;
  workRequestId: string | null;
  assignmentId: string | null;
  providerUserId: string | null;
  automationState: string;
  proposedDocumentId: string | null;
  reason: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface AccountingAutomationEventsResponse {
  events: AccountingAutomationEvent[];
  migrationRequired?: string;
}

interface AccountingAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  normalBalance: string;
  isActive: boolean;
}

interface AccountingAccountsResponse {
  profileId: string | null;
  accounts: AccountingAccount[];
  migrationRequired?: string;
}

interface AccountingJournalLine {
  id: string;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  description: string | null;
  debit: number;
  credit: number;
}

interface AccountingJournalEntry {
  id: string;
  status: string;
  entryDate: string;
  sourceSurface: string;
  sourceType: string | null;
  sourceId: string | null;
  description: string | null;
  postedAt: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lines: AccountingJournalLine[];
}

interface AccountingJournalEntriesResponse {
  entries: AccountingJournalEntry[];
  migrationRequired?: string;
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
  const [invoiceTotalsByEvent, setInvoiceTotalsByEvent] = useState<Record<string, string>>({});
  const [journalDescription, setJournalDescription] = useState("");
  const [journalLines, setJournalLines] = useState([
    { accountId: "", debit: "", credit: "" },
    { accountId: "", debit: "", credit: "" },
  ]);
  const [newAccountCode, setNewAccountCode] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("expense");

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

  const { data: automationData, isLoading: isAutomationLoading } =
    useQuery<AccountingAutomationEventsResponse>({
      queryKey: ["/api/accounting/automation-events", "proposed"],
      queryFn: async () => {
        const res = await fetch("/api/accounting/automation-events?state=proposed", {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          throw new Error(`Failed to load automation events (${res.status})`);
        }
        return (await res.json()) as AccountingAutomationEventsResponse;
      },
    });

  const { data: accountsData } = useQuery<AccountingAccountsResponse>({
    queryKey: ["/api/accounting/accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/accounts", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load accounting accounts (${res.status})`);
      }
      return (await res.json()) as AccountingAccountsResponse;
    },
  });

  const { data: journalEntriesData } = useQuery<AccountingJournalEntriesResponse>({
    queryKey: ["/api/accounting/journal-entries"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/journal-entries", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load journal entries (${res.status})`);
      }
      return (await res.json()) as AccountingJournalEntriesResponse;
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

  const skipAutomation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounting/automation-events/${id}/skip`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ reason: "Skipped from automation review inbox." }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to skip automation event (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Automation skipped",
        description: "This connected event will not create finance records.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/automation-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/books-foundation"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not skip automation",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const prepareInvoice = useMutation({
    mutationFn: async (event: AccountingAutomationEvent) => {
      const total = Number(invoiceTotalsByEvent[event.id] || 0);
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error("Enter a draft invoice total greater than zero.");
      }

      const res = await fetch(`/api/accounting/automation-events/${event.id}/prepare-invoice`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          projectTitle: event.metadata?.title || undefined,
          total,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to prepare invoice (${res.status})`);
      }
      return res.json() as Promise<{ document: AccountingRecord }>;
    },
    onSuccess: (result) => {
      toast({
        title: "Draft invoice prepared",
        description: "Review it before sending or recording payment.",
      });
      setInvoiceTotalsByEvent({});
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/automation-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/standalone-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/job-flows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/books-foundation"] });
      if (result.document?.job_id) {
        navigate(`/finances/invoices?jobId=${encodeURIComponent(result.document.job_id)}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Could not prepare invoice",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const prepareExpense = useMutation({
    mutationFn: async (event: AccountingAutomationEvent) => {
      const total = Number(invoiceTotalsByEvent[event.id] || event.metadata?.total || 0);
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error("Enter an expense total greater than zero.");
      }

      const res = await fetch(`/api/accounting/automation-events/${event.id}/prepare-expense`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          projectTitle: event.metadata?.title || undefined,
          total,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to prepare expense (${res.status})`);
      }
      return res.json() as Promise<{ document: AccountingRecord }>;
    },
    onSuccess: (result) => {
      toast({
        title: "Expense prepared",
        description: "Review the expense before posting books or reporting.",
      });
      setInvoiceTotalsByEvent({});
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/automation-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/job-flows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/books-foundation"] });
      if (result.document?.job_id) {
        navigate(`/finances/expenses?jobId=${encodeURIComponent(result.document.job_id)}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Could not prepare expense",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const createAccount = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting/accounts", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          code: newAccountCode,
          name: newAccountName,
          accountType: newAccountType,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to create account (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Account added", description: "Chart of accounts updated." });
      setNewAccountCode("");
      setNewAccountName("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/books-foundation"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not add account",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const createJournalEntry = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting/journal-entries", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          description: journalDescription,
          post: true,
          lines: journalLines.map((line) => ({
            accountId: line.accountId,
            debit: Number(line.debit || 0),
            credit: Number(line.credit || 0),
          })),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to create journal entry (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Journal entry posted",
        description: "Balanced manual entry saved to the books foundation.",
      });
      setJournalDescription("");
      setJournalLines([
        { accountId: "", debit: "", credit: "" },
        { accountId: "", debit: "", credit: "" },
      ]);
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/books-foundation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/journal-entries"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not post journal entry",
        description: formatUserFacingErrorMessage(error, "Check that debits equal credits."),
        variant: "destructive",
      });
    },
  });

  const records = data?.records ?? [];
  const automationEvents = automationData?.events ?? [];
  const accounts = accountsData?.accounts ?? [];
  const journalEntries = journalEntriesData?.entries ?? [];

  const journalDebitTotal = journalLines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const journalCreditTotal = journalLines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  const journalBalanced = journalDebitTotal > 0 && journalDebitTotal === journalCreditTotal;

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

      <Card className="bg-tsCard border-ts-orange/25">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">
            Automation review inbox
          </CardTitle>
          <CardDescription className="text-xs text-white/60">
            Connected hiring and Scout events can prepare finance records, but you review before
            anything is sent, posted, marked paid, or moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {automationData?.migrationRequired ? (
            <p className="text-[11px] text-white/60">
              Books foundation migration is required before automation proposals can appear.
            </p>
          ) : isAutomationLoading ? (
            <p className="text-[11px] text-white/60">Loading automation proposals...</p>
          ) : automationEvents.length === 0 ? (
            <p className="text-[11px] text-white/60">
              No connected accounting proposals yet. Accepted Direct Connect work will appear here
              for review.
            </p>
          ) : (
            <div className="space-y-2">
              {automationEvents.map((event) => {
                const titleText =
                  (typeof event.metadata?.title === "string" && event.metadata.title) ||
                  `${event.sourceSurface.replace(/_/g, " ")} ${event.sourceId.slice(0, 8)}`;
                const responseSummary = event.metadata?.responseSummary || {};
                const canPrepareExpense =
                  event.sourceType === "material_list_created" ||
                  event.sourceType === "expense_created";
                const canPrepareInvoice =
                  !canPrepareExpense ||
                  event.sourceType === "estimate_created" ||
                  event.sourceType === "contract_created" ||
                  event.sourceType === "invoice_created" ||
                  event.sourceType === "assignment_accepted";

                return (
                  <div key={event.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-ts-orange">
                          {event.sourceSurface.replace(/_/g, " ")} ·{" "}
                          {event.sourceType.replace(/_/g, " ")}
                        </div>
                        <h2 className="mt-1 text-sm font-semibold text-white">{titleText}</h2>
                        <p className="mt-1 max-w-2xl text-[11px] leading-5 text-white/60">
                          {event.reason ||
                            "Connected activity is ready to become reviewable finance work."}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/50">
                          {event.workRequestId && <span>Request: {event.workRequestId}</span>}
                          {event.assignmentId && <span>Assignment: {event.assignmentId}</span>}
                          {responseSummary.priceBand && (
                            <span>Price band: {String(responseSummary.priceBand)}</span>
                          )}
                          {responseSummary.availabilityWindow && (
                            <span>Availability: {String(responseSummary.availabilityWindow)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex w-full flex-col gap-2 lg:w-[260px]">
                        <Input
                          placeholder={canPrepareExpense ? "Expense total" : "Draft invoice total"}
                          value={
                            invoiceTotalsByEvent[event.id] ||
                            (event.metadata?.total ? String(event.metadata.total) : "")
                          }
                          onChange={(e) =>
                            setInvoiceTotalsByEvent((prev) => ({
                              ...prev,
                              [event.id]: e.target.value,
                            }))
                          }
                          className="h-9 bg-tsCard border-white/10 text-tsText text-xs"
                        />
                        <div className="flex gap-2">
                          {canPrepareInvoice && (
                            <Button
                              size="sm"
                              className="h-8 flex-1 px-3 text-[11px]"
                              disabled={prepareInvoice.isPending}
                              onClick={() => prepareInvoice.mutate(event)}
                            >
                              Prepare invoice
                            </Button>
                          )}
                          {canPrepareExpense && (
                            <Button
                              size="sm"
                              className="h-8 flex-1 px-3 text-[11px]"
                              disabled={prepareExpense.isPending}
                              onClick={() => prepareExpense.mutate(event)}
                            >
                              Prepare expense
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 border-white/15 text-[11px] text-white/70"
                            disabled={skipAutomation.isPending}
                            onClick={() => skipAutomation.mutate(event.id)}
                          >
                            Skip
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">Manual books tools</CardTitle>
          <CardDescription className="text-xs text-white/60">
            Use the chart of accounts and balanced journal entries directly, similar to traditional
            bookkeeping software.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
            <div className="rounded-lg border border-white/10 bg-black/25 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-white/70">
                  Chart of accounts
                </h2>
                <span className="text-[10px] text-white/50">{accounts.length} accounts</span>
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                {accounts.slice(0, 24).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-tsCard/80 px-2 py-1.5 text-[11px]"
                  >
                    <span className="truncate text-white">
                      {account.code} · {account.name}
                    </span>
                    <span className="shrink-0 text-white/45">{account.accountType}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
                  <Input
                    placeholder="Code"
                    value={newAccountCode}
                    onChange={(e) => setNewAccountCode(e.target.value)}
                    className="h-9 bg-tsCard border-white/10 text-tsText text-xs"
                  />
                  <Input
                    placeholder="Account name"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="h-9 bg-tsCard border-white/10 text-tsText text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value)}
                    className="h-9 flex-1 rounded-md bg-tsCard border border-white/10 px-2 text-xs text-tsText"
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="income">Income</option>
                    <option value="cogs">COGS</option>
                    <option value="expense">Expense</option>
                  </select>
                  <Button
                    size="sm"
                    className="h-9 px-3 text-[11px]"
                    disabled={createAccount.isPending}
                    onClick={() => createAccount.mutate()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/25 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-white/70">
                  Manual journal entry
                </h2>
                <span
                  className={`text-[10px] font-semibold ${
                    journalBalanced ? "text-emerald-300" : "text-amber-200"
                  }`}
                >
                  Dr {formatCurrency(journalDebitTotal)} / Cr {formatCurrency(journalCreditTotal)}
                </span>
              </div>
              <Input
                placeholder="Entry description"
                value={journalDescription}
                onChange={(e) => setJournalDescription(e.target.value)}
                className="mb-3 h-9 bg-tsCard border-white/10 text-tsText text-xs"
              />
              <div className="space-y-2">
                {journalLines.map((line, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_0.45fr_0.45fr]"
                  >
                    <select
                      value={line.accountId}
                      onChange={(e) =>
                        setJournalLines((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, accountId: e.target.value } : row
                          )
                        )
                      }
                      className="h-9 rounded-md bg-tsCard border border-white/10 px-2 text-xs text-tsText"
                    >
                      <option value="">Choose account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} · {account.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Debit"
                      value={line.debit}
                      onChange={(e) =>
                        setJournalLines((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, debit: e.target.value, credit: "" } : row
                          )
                        )
                      }
                      className="h-9 bg-tsCard border-white/10 text-tsText text-xs"
                    />
                    <Input
                      placeholder="Credit"
                      value={line.credit}
                      onChange={(e) =>
                        setJournalLines((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, credit: e.target.value, debit: "" } : row
                          )
                        )
                      }
                      className="h-9 bg-tsCard border-white/10 text-tsText text-xs"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 border-white/15 text-[11px] text-white/70"
                  onClick={() =>
                    setJournalLines((prev) => [...prev, { accountId: "", debit: "", credit: "" }])
                  }
                >
                  Add line
                </Button>
                <Button
                  size="sm"
                  className="h-8 px-3 text-[11px]"
                  disabled={!journalBalanced || createJournalEntry.isPending}
                  onClick={() => createJournalEntry.mutate()}
                >
                  Post journal entry
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-white/70">
                General ledger entries
              </h2>
              <span className="text-[10px] text-white/50">{journalEntries.length} recent</span>
            </div>
            {journalEntries.length === 0 ? (
              <p className="text-[11px] text-white/60">
                Manual journal entries will appear here after they are posted.
              </p>
            ) : (
              <div className="space-y-2">
                {journalEntries.slice(0, 8).map((entry) => {
                  const debitTotal = entry.lines.reduce((sum, line) => sum + line.debit, 0);
                  const creditTotal = entry.lines.reduce((sum, line) => sum + line.credit, 0);
                  return (
                    <div
                      key={entry.id}
                      className="rounded-md border border-white/10 bg-tsCard/80 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {entry.description || "Manual journal entry"}
                          </p>
                          <p className="text-[11px] text-white/55">
                            {entry.status} · {entry.sourceSurface.replace(/_/g, " ")} ·{" "}
                            {new Date(entry.entryDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right text-[11px] text-white/60">
                          <div>Dr {formatCurrency(debitTotal)}</div>
                          <div>Cr {formatCurrency(creditTotal)}</div>
                        </div>
                      </div>
                      <div className="mt-2 divide-y divide-white/10">
                        {entry.lines.map((line) => (
                          <div
                            key={line.id}
                            className="grid grid-cols-[1fr_0.45fr_0.45fr] gap-2 py-1.5 text-[11px]"
                          >
                            <span className="truncate text-white/70">
                              {line.accountCode || "----"} · {line.accountName || "Unknown account"}
                            </span>
                            <span className="text-right text-white/60">
                              {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                            </span>
                            <span className="text-right text-white/60">
                              {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
