import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  MapPin,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

interface PendingListing {
  id: string;
  title: string;
  description?: string | null;
  price: string | number;
  condition?: string | null;
  city?: string | null;
  state?: string | null;
  createdAt: string | Date;
  category?: string | null;
  sellerName?: string | null;
  sellerEmail?: string | null;
  [key: string]: unknown;
}

function readable(value: unknown): string {
  const text = String(value || "").trim();
  return text ? text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not recorded";
}

function priceValue(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: unknown): string {
  const parsed = priceValue(value);
  if (parsed === null) return "Price not recorded";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed);
}

function formatDate(value: unknown): string {
  if (!value) return "Date not recorded";
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Invalid date";
}

function locationLabel(listing: PendingListing): string {
  return [listing.city, listing.state].filter(Boolean).join(", ") || "Location not recorded";
}

export default function AdminListings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedListing, setSelectedListing] = useState<PendingListing | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [search, setSearch] = useState("");

  const listingsQuery = useQuery<PendingListing[]>({
    queryKey: ["/api/admin/marketplace/pending"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/marketplace/pending");
      return Array.isArray(response) ? (response as PendingListing[]) : [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes: adminNotes }: { id: string; notes?: string }) =>
      apiRequest("POST", `/api/admin/marketplace/listings/${id}/approve`, {
        notes: adminNotes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/pending"] });
      toast({
        title: "Listing approved",
        description: "The listing is now live.",
      });
      setSelectedListing(null);
      setNotes("");
      setRejectionReason("");
    },
    onError: (error: unknown) => {
      toast({
        title: "Listing was not approved",
        description: formatUserFacingErrorMessage(error, "Failed to approve the listing."),
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      id,
      reason,
      notes: adminNotes,
    }: {
      id: string;
      reason: string;
      notes?: string;
    }) =>
      apiRequest("POST", `/api/admin/marketplace/listings/${id}/reject`, {
        reason,
        notes: adminNotes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/pending"] });
      toast({
        title: "Listing rejected",
        description: "The seller will receive the recorded reason.",
      });
      setSelectedListing(null);
      setNotes("");
      setRejectionReason("");
    },
    onError: (error: unknown) => {
      toast({
        title: "Listing was not rejected",
        description: formatUserFacingErrorMessage(error, "Failed to reject the listing."),
        variant: "destructive",
      });
    },
  });

  const pendingListings = listingsQuery.data || [];
  const filteredListings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return pendingListings
      .filter((listing) => {
        if (!normalizedSearch) return true;
        return [
          listing.title,
          listing.description,
          listing.condition,
          listing.city,
          listing.state,
          listing.category,
          listing.sellerName,
          listing.sellerEmail,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [pendingListings, search]);

  const totalValue = useMemo(
    () => pendingListings.reduce((sum, listing) => sum + (priceValue(listing.price) || 0), 0),
    [pendingListings]
  );
  const distinctLocations = useMemo(
    () => new Set(pendingListings.map(locationLabel).filter((value) => value !== "Location not recorded")).size,
    [pendingListings]
  );

  const selectListing = (listing: PendingListing) => {
    setSelectedListing(listing);
    setNotes("");
    setRejectionReason("");
  };

  const approveSelected = () => {
    if (!selectedListing) return;
    approveMutation.mutate({ id: selectedListing.id, notes: notes.trim() || undefined });
  };

  const rejectSelected = () => {
    if (!selectedListing) return;
    if (!rejectionReason.trim()) {
      toast({
        title: "Rejection reason required",
        description: "Record a clear seller-facing reason before rejecting the listing.",
        variant: "destructive",
      });
      return;
    }
    rejectMutation.mutate({
      id: selectedListing.id,
      reason: rejectionReason.trim(),
      notes: notes.trim() || undefined,
    });
  };

  if (listingsQuery.isLoading) {
    return (
      <AdminWorkspace>
        <div className="flex min-h-64 items-center justify-center border-y border-white/10 text-sm text-white/50">
          <RefreshCw className="mr-3 h-5 w-5 animate-spin" />
          Loading marketplace listings…
        </div>
      </AdminWorkspace>
    );
  }

  if (listingsQuery.isError) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="Marketplace approval queue unavailable"
          description="Pending listings could not be read. No listing was approved or rejected."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => listingsQuery.refetch()}
              className="border-white/15 bg-transparent text-white"
            >
              Retry
            </Button>
          }
        />
      </AdminWorkspace>
    );
  }

  return (
    <AdminWorkspace data-testid="admin-marketplace-listings-v2">
      <AdminSection
        title="Marketplace approval queue"
        description="Review the listing, seller-facing rejection reason, and admin notes before changing public visibility."
        className="pt-0"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => listingsQuery.refetch()}
            disabled={listingsQuery.isFetching}
            className="border-white/12 bg-white/[0.025] text-white/65 hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${listingsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Pending",
              value: pendingListings.length,
              detail: "Listings awaiting an admin decision",
              tone: pendingListings.length > 0 ? "warning" : "good",
            },
            {
              label: "Asking value",
              value: formatMoney(totalValue),
              detail: "Combined advertised price of pending listings",
            },
            {
              label: "Locations",
              value: distinctLocations,
              detail: "Distinct city and state combinations",
            },
            {
              label: "Selected",
              value: selectedListing ? "1" : "—",
              detail: selectedListing ? selectedListing.title : "Choose a listing to review",
            },
          ]}
        />

        <AdminToolbar className="mt-4">
          <div className="relative min-w-0 flex-1 md:max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, description, category, location, or seller"
              className="border-white/10 bg-black/20 pl-9 text-white placeholder:text-white/30"
            />
          </div>
          <p className="text-xs text-white/35">
            {filteredListings.length} of {pendingListings.length} shown
          </p>
        </AdminToolbar>
      </AdminSection>

      {pendingListings.length === 0 ? (
        <AdminEmptyState
          title="No pending marketplace listings"
          description="Every submitted listing currently has an admin decision."
        />
      ) : (
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
          <AdminSection
            title="Pending listings"
            description="Newest submissions appear first."
            className="pt-0"
          >
            {filteredListings.length ? (
              <AdminList>
                {filteredListings.map((listing) => {
                  const selected = selectedListing?.id === listing.id;
                  return (
                    <button
                      key={listing.id}
                      type="button"
                      onClick={() => selectListing(listing)}
                      className={`grid w-full gap-3 px-3 py-4 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.55fr)] sm:items-center sm:px-4 ${
                        selected ? "bg-orange-500/[0.08]" : "hover:bg-white/[0.025]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold text-white">{listing.title || "Untitled listing"}</span>
                          <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100">
                            <Clock className="mr-1 h-3 w-3" />
                            Pending
                          </Badge>
                        </span>
                        <span className="mt-2 line-clamp-2 block text-sm leading-6 text-white/48">
                          {listing.description || "No description was provided."}
                        </span>
                        <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/35">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {locationLabel(listing)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(listing.createdAt)}
                          </span>
                        </span>
                      </span>
                      <span className="sm:text-right">
                        <span className="block text-lg font-semibold text-white">{formatMoney(listing.price)}</span>
                        <span className="mt-1 block text-xs text-white/35">{readable(listing.condition)}</span>
                      </span>
                    </button>
                  );
                })}
              </AdminList>
            ) : (
              <AdminEmptyState
                title="No pending listings match this search"
                description="Clear or change the search to inspect another submission."
              />
            )}
          </AdminSection>

          <AdminSection
            title="Review decision"
            description="The selected listing remains unchanged until Approve or Reject is submitted."
            className="pt-0 xl:sticky xl:top-[6rem] xl:self-start"
          >
            {selectedListing ? (
              <div className="border-y border-white/10">
                <div className="px-3 py-5 sm:px-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold text-white">{selectedListing.title || "Untitled listing"}</h3>
                      <p className="mt-2 line-clamp-4 text-sm leading-6 text-white/52">
                        {selectedListing.description || "No description was provided."}
                      </p>
                    </div>
                    <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100">Pending</Badge>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <ReviewFact label="Price" value={formatMoney(selectedListing.price)} icon={DollarSign} />
                    <ReviewFact label="Condition" value={readable(selectedListing.condition)} icon={CheckCircle2} />
                    <ReviewFact label="Location" value={locationLabel(selectedListing)} icon={MapPin} />
                    <ReviewFact label="Created" value={formatDate(selectedListing.createdAt)} icon={Calendar} />
                  </div>
                </div>

                <div className="space-y-4 border-t border-white/10 px-3 py-5 sm:px-4">
                  <div className="space-y-2">
                    <Label htmlFor="listing-admin-notes" className="text-white/65">Admin notes</Label>
                    <Textarea
                      id="listing-admin-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Optional internal notes about the decision"
                      className="min-h-24 border-white/10 bg-black/20 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="listing-rejection-reason" className="text-white/65">
                      Seller-facing rejection reason
                    </Label>
                    <Textarea
                      id="listing-rejection-reason"
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                      placeholder="Required only when rejecting"
                      className="min-h-28 border-white/10 bg-black/20 text-white"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      onClick={approveSelected}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="bg-emerald-400 text-black hover:bg-emerald-300"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {approveMutation.isPending ? "Approving…" : "Approve listing"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={rejectSelected}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="border-red-300/25 bg-transparent text-red-100 hover:bg-red-400/10"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      {rejectMutation.isPending ? "Rejecting…" : "Reject listing"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <AdminEmptyState
                title="Select a listing"
                description="Choose a pending listing to inspect its details and record the approval decision."
              />
            )}
          </AdminSection>
        </div>
      )}
    </AdminWorkspace>
  );
}

function ReviewFact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">{label}</p>
      <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-white/62">
        <Icon className="mt-1 h-4 w-4 shrink-0 text-orange-300" />
        <span>{value}</span>
      </p>
    </div>
  );
}
