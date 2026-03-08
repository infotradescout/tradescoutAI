import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLocation } from "wouter";
import { Page } from "@/components/layout/PagePrimitives";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

interface ClientStats {
  invoiceCount: number;
  totalBilled: number;
  paidAmount: number;
  unpaidAmount: number;
}

interface AccountingClient {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isArchived: boolean;
  profileBacked: boolean;
  stats: ClientStats;
}

interface AccountingClientsResponse {
  clients: AccountingClient[];
  capabilities?: {
    canPersistProfiles?: boolean;
  };
}

export default function FinancesClientsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showArchived, setShowArchived] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [renameLedger, setRenameLedger] = useState(false);

  const clientsQueryKey = [
    "/api/accounting/clients",
    showArchived ? "with-archived" : "active-only",
  ];

  const { data, isLoading } = useQuery<AccountingClientsResponse>({
    queryKey: clientsQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ includeArchived: String(showArchived) });
      const res = await fetch(`/api/accounting/clients?${params.toString()}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load clients (${res.status})`);
      }
      return (await res.json()) as AccountingClientsResponse;
    },
  });

  const createClient = useMutation({
    mutationFn: async () => {
      const name = newDisplayName.trim();
      if (!name) {
        throw new Error("Client name is required.");
      }

      const res = await fetch("/api/accounting/clients", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          displayName: name,
          email: newEmail.trim() || undefined,
          phone: newPhone.trim() || undefined,
          notes: newNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to add client (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Client added",
        description: "Client profile is now available across your finances workspace.",
      });
      setNewDisplayName("");
      setNewEmail("");
      setNewPhone("");
      setNewNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/clients"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not add client",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const updateClient = useMutation({
    mutationFn: async (opts: { id: string; isArchived?: boolean; previousName?: string }) => {
      const nextName = editDisplayName.trim();
      if (!nextName) {
        throw new Error("Client name is required.");
      }

      const patchRes = await fetch(`/api/accounting/clients/${opts.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          displayName: nextName,
          email: editEmail.trim() || undefined,
          phone: editPhone.trim() || undefined,
          notes: editNotes.trim() || undefined,
          isArchived: Boolean(opts.isArchived),
        }),
      });
      if (!patchRes.ok) {
        const text = await patchRes.text().catch(() => "");
        throw new Error(text || `Failed to update client (${patchRes.status})`);
      }

      const shouldRenameLedger =
        renameLedger &&
        typeof opts.previousName === "string" &&
        opts.previousName.trim().toLowerCase() !== nextName.toLowerCase();

      if (shouldRenameLedger) {
        const renameRes = await fetch(`/api/accounting/clients/${opts.id}/rename-ledger`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            previousName: opts.previousName,
            nextName,
          }),
        });
        if (!renameRes.ok) {
          const text = await renameRes.text().catch(() => "");
          throw new Error(text || `Failed to rename client ledger (${renameRes.status})`);
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Client updated",
        description: "Client profile changes are now saved.",
      });
      setEditingId(null);
      setRenameLedger(false);
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/standalone-invoices"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not update client",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const toggleArchived = useMutation({
    mutationFn: async (row: AccountingClient) => {
      const res = await fetch(`/api/accounting/clients/${row.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          displayName: row.displayName,
          email: row.email || undefined,
          phone: row.phone || undefined,
          notes: row.notes || undefined,
          isArchived: !row.isArchived,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to update client (${res.status})`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/clients"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not update client",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const rows = useMemo(() => {
    const source = data?.clients ?? [];
    return source.sort((a, b) => {
      if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
      return (b.stats?.unpaidAmount || 0) - (a.stats?.unpaidAmount || 0);
    });
  }, [data]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.totalBilled += row.stats?.totalBilled || 0;
          acc.totalUnpaid += row.stats?.unpaidAmount || 0;
          return acc;
        },
        { totalBilled: 0, totalUnpaid: 0 }
      ),
    [rows]
  );

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "-";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  const beginEdit = (row: AccountingClient) => {
    setEditingId(row.id);
    setEditDisplayName(row.displayName || "");
    setEditEmail(row.email || "");
    setEditPhone(row.phone || "");
    setEditNotes(row.notes || "");
    setRenameLedger(false);
  };

  const canPersistProfiles = Boolean(data?.capabilities?.canPersistProfiles);

  return (
    <Page className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">Clients</h1>
          <p className="text-sm text-white/60">
            Add and manage clients directly, then run invoices and estimates without leaving
            Finances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-white/15 text-[11px] text-white/70"
            onClick={() => navigate("/finances/invoices")}
          >
            Add invoice
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-white/15 text-[11px] text-white/70"
            onClick={() => navigate("/finances/estimates")}
          >
            Add estimate
          </Button>
        </div>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">Add client profile</CardTitle>
          <CardDescription className="text-xs text-white/60">
            Create a client once, then attach invoices, estimates, and records from every finance
            page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!canPersistProfiles && (
            <p className="text-[11px] text-amber-300/80">
              Client profiles are not persisted until the latest database migration is applied.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              placeholder="Client name"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="h-10 bg-tsCard border-white/10 text-white text-sm"
            />
            <Input
              placeholder="Email (optional)"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="h-10 bg-tsCard border-white/10 text-white text-sm"
            />
            <Input
              placeholder="Phone (optional)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="h-10 bg-tsCard border-white/10 text-white text-sm"
            />
            <Input
              placeholder="Notes (optional)"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="h-10 bg-tsCard border-white/10 text-white text-sm"
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => createClient.mutate()}
              disabled={createClient.isPending || !canPersistProfiles}
            >
              {createClient.isPending ? "Adding..." : "Add client"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-tsCard border-white/10">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-white">Clients ledger</CardTitle>
            <CardDescription className="text-xs text-white/60">
              Manage your client profile data and see invoice-backed balances in one place.
            </CardDescription>
          </div>
          <div className="text-[11px] text-white/60 text-right flex flex-col items-end gap-0.5">
            <span>
              {rows.length.toLocaleString()} client{rows.length === 1 ? "" : "s"}
            </span>
            <span>Open balance: {formatCurrency(totals.totalUnpaid)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-white/70"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-[11px] text-white/60 py-4">Loading clients...</p>
          ) : rows.length === 0 ? (
            <p className="text-[11px] text-white/60 py-4">
              Add your first client profile above, or create an invoice with a client name to seed
              the ledger.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <Table className="min-w-full text-xs">
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="w-[24%] text-white/60">Client</TableHead>
                    <TableHead className="w-[13%] text-right text-white/60">Open</TableHead>
                    <TableHead className="w-[13%] text-right text-white/60">Billed</TableHead>
                    <TableHead className="w-[12%] text-right text-white/60">Invoices</TableHead>
                    <TableHead className="w-[38%] text-right text-white/60">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isEditing = editingId === row.id;
                    return (
                      <TableRow
                        key={row.id}
                        className="border-white/10 hover:bg-tsCard/95 align-top"
                      >
                        <TableCell className="py-2 text-[11px] text-white max-w-[260px]">
                          {isEditing ? (
                            <div className="space-y-2">
                              <Input
                                value={editDisplayName}
                                onChange={(e) => setEditDisplayName(e.target.value)}
                                className="h-8 bg-tsCard border-white/10 text-white text-xs"
                                placeholder="Client name"
                              />
                              <Input
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="h-8 bg-tsCard border-white/10 text-white text-xs"
                                placeholder="Email"
                              />
                              <Input
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                className="h-8 bg-tsCard border-white/10 text-white text-xs"
                                placeholder="Phone"
                              />
                              <Input
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                className="h-8 bg-tsCard border-white/10 text-white text-xs"
                                placeholder="Notes"
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate">{row.displayName}</span>
                              <span className="text-[10px] text-white/60 truncate">
                                {row.email || row.phone || "No contact details"}
                              </span>
                              {row.isArchived && (
                                <span className="text-[10px] text-amber-300">Archived</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-right text-[11px] text-white/70">
                          {formatCurrency(row.stats?.unpaidAmount)}
                        </TableCell>
                        <TableCell className="py-2 text-right text-[11px] text-white">
                          {formatCurrency(row.stats?.totalBilled)}
                        </TableCell>
                        <TableCell className="py-2 text-right text-[11px] text-white/70">
                          {(row.stats?.invoiceCount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 text-right text-[11px] text-white/70">
                          {isEditing ? (
                            <div className="flex flex-col items-end gap-2">
                              <label className="flex items-center gap-2 text-[10px] text-white/70">
                                <input
                                  type="checkbox"
                                  checked={renameLedger}
                                  onChange={(e) => setRenameLedger(e.target.checked)}
                                />
                                Rename existing invoice ledger names
                              </label>
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-3 text-[11px]"
                                  onClick={() => {
                                    setEditingId(null);
                                    setRenameLedger(false);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 px-3 text-[11px]"
                                  onClick={() =>
                                    updateClient.mutate({
                                      id: row.id,
                                      isArchived: row.isArchived,
                                      previousName: row.displayName,
                                    })
                                  }
                                  disabled={updateClient.isPending}
                                >
                                  {updateClient.isPending ? "Saving..." : "Save"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap justify-end gap-2">
                              {row.profileBacked ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-3 border-white/10 text-[11px] text-white/80"
                                    onClick={() => beginEdit(row)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-3 border-white/10 text-[11px] text-white/80"
                                    onClick={() => toggleArchived.mutate(row)}
                                    disabled={toggleArchived.isPending}
                                  >
                                    {row.isArchived ? "Unarchive" : "Archive"}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-3 border-white/10 text-[11px] text-white/80"
                                  onClick={() => {
                                    setNewDisplayName(row.displayName);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                >
                                  Promote to profile
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-3 border-white/10 text-[11px] text-white/80"
                                onClick={() =>
                                  navigate(
                                    `/finances/invoices?client=${encodeURIComponent(row.displayName)}`
                                  )
                                }
                              >
                                Open invoices
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-3 border-white/10 text-[11px] text-white/80"
                                onClick={() =>
                                  navigate(
                                    `/finances/invoices?client=${encodeURIComponent(row.displayName)}#new`
                                  )
                                }
                              >
                                Add invoice
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
