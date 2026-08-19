import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  Phone,
  RefreshCw,
  Search,
  UserCheck,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

interface AddressVerification {
  id: string;
  userId: string;
  fullAddress: string;
  city: string;
  state: string;
  zipCode: string;
  verificationMethod: string;
  status: "pending" | "submitted" | "approved" | "rejected" | "expired";
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  deadline: string;
  adminNotes?: string;
  postcardSentAt?: string;
  postcardVerifiedAt?: string;
  createdAt: string;
}

interface VerificationUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  addressVerified: boolean;
}

interface VerificationWithUser {
  verification: AddressVerification;
  user: VerificationUser;
}

type ReviewStatus = "pending" | "approved" | "rejected";

const FILTER_STATUSES = [
  "pending",
  "submitted",
  "approved",
  "rejected",
  "expired",
] as const;

function readable(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayName(user: VerificationUser): string {
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return fullName || user.email || "Unknown user";
}

function formatDate(value: unknown): string {
  if (!value) return "Not recorded";
  const date = new Date(value as string | number | Date);
  if (!Number.isFinite(date.getTime())) return "Invalid date";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysRemaining(deadline: unknown): number | null {
  if (!deadline) return null;
  const date = new Date(deadline as string | number | Date);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function statusBadge(status: AddressVerification["status"]) {
  const classes: Record<AddressVerification["status"], string> = {
    pending: "border-amber-400/30 bg-amber-400/10 text-amber-100",
    submitted: "border-sky-400/30 bg-sky-400/10 text-sky-100",
    approved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    rejected: "border-red-400/30 bg-red-400/10 text-red-200",
    expired: "border-orange-400/30 bg-orange-400/10 text-orange-100",
  };
  return <Badge className={classes[status]}>{readable(status)}</Badge>;
}

function MethodIcon({ method }: { method: string }) {
  if (method === "postcard") return <Mail className="h-4 w-4" />;
  if (method === "phone_verification") return <Phone className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function sortRank(status: AddressVerification["status"]): number {
  if (status === "submitted") return 0;
  if (status === "pending") return 1;
  if (status === "expired") return 2;
  if (status === "rejected") return 3;
  return 4;
}

export default function AdminAddressVerifications() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedVerification, setSelectedVerification] =
    useState<VerificationWithUser | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("pending");
  const [adminNotes, setAdminNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const verificationsQuery = useQuery<VerificationWithUser[]>({
    queryKey: ["/api/admin/address-verifications", statusFilter],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/admin/address-verifications?status=${encodeURIComponent(statusFilter)}`
      );
      return Array.isArray(response) ? (response as VerificationWithUser[]) : [];
    },
  });

  const updateVerificationMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: ReviewStatus;
      notes: string;
    }) =>
      apiRequest("PUT", `/api/admin/address-verifications/${id}`, {
        status,
        adminNotes: notes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/admin/address-verifications"],
      });
      toast({
        title: "Address verification updated",
        description: "The review decision and admin notes were saved.",
      });
      setSelectedVerification(null);
      setReviewStatus("pending");
      setAdminNotes("");
    },
    onError: (error: unknown) => {
      toast({
        title: "Address verification was not updated",
        description: formatUserFacingErrorMessage(error, "Failed to save the review decision."),
        variant: "destructive",
      });
    },
  });

  const verifications = verificationsQuery.data || [];
  const filteredVerifications = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return verifications
      .filter((item) => {
        if (!normalizedSearch) return true;
        const verification = item.verification;
        const user = item.user;
        return [
          user.email,
          user.firstName,
          user.lastName,
          verification.fullAddress,
          verification.city,
          verification.state,
          verification.zipCode,
          verification.verificationMethod,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        const statusDifference =
          sortRank(a.verification.status) - sortRank(b.verification.status);
        if (statusDifference !== 0) return statusDifference;
        const aTime = a.verification.submittedAt
          ? new Date(a.verification.submittedAt).getTime()
          : new Date(a.verification.createdAt).getTime();
        const bTime = b.verification.submittedAt
          ? new Date(b.verification.submittedAt).getTime()
          : new Date(b.verification.createdAt).getTime();
        return bTime - aTime;
      });
  }, [search, verifications]);

  const counts = useMemo(
    () => ({
      pending: verifications.filter((item) => item.verification.status === "pending").length,
      submitted: verifications.filter((item) => item.verification.status === "submitted").length,
      approved: verifications.filter((item) => item.verification.status === "approved").length,
      overdue: verifications.filter((item) => {
        const remaining = daysRemaining(item.verification.deadline);
        return remaining !== null && remaining < 0 && item.verification.status !== "approved";
      }).length,
    }),
    [verifications]
  );

  const openReview = (item: VerificationWithUser) => {
    const current = item.verification.status;
    setSelectedVerification(item);
    setReviewStatus(
      current === "approved" || current === "rejected" || current === "pending"
        ? current
        : "pending"
    );
    setAdminNotes(item.verification.adminNotes || "");
  };

  const submitReview = () => {
    if (!selectedVerification) return;
    updateVerificationMutation.mutate({
      id: selectedVerification.verification.id,
      status: reviewStatus,
      notes: adminNotes,
    });
  };

  if (verificationsQuery.isLoading) {
    return (
      <AdminWorkspace>
        <div className="flex min-h-64 items-center justify-center border-y border-white/10 text-sm text-white/50">
          <RefreshCw className="mr-3 h-5 w-5 animate-spin" />
          Loading address verifications…
        </div>
      </AdminWorkspace>
    );
  }

  if (verificationsQuery.isError) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="Address verification queue unavailable"
          description="The queue could not be read. No verification state was changed."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => verificationsQuery.refetch()}
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
    <AdminWorkspace data-testid="admin-address-verifications-v2">
      <AdminSection
        title="Address and identity queue"
        description="Review submitted address evidence, deadlines, and prior decisions without changing any unrelated account state."
        className="pt-0"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => verificationsQuery.refetch()}
            disabled={verificationsQuery.isFetching}
            className="border-white/12 bg-white/[0.025] text-white/65 hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${verificationsQuery.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Submitted",
              value: counts.submitted,
              detail: "Ready for an admin decision",
              tone: counts.submitted > 0 ? "warning" : "good",
            },
            {
              label: "Pending",
              value: counts.pending,
              detail: "Waiting for user evidence or completion",
            },
            {
              label: "Approved",
              value: counts.approved,
              detail: "Approved in the current result set",
              tone: "good",
            },
            {
              label: "Overdue",
              value: counts.overdue,
              detail: "Past deadline and not approved",
              tone: counts.overdue > 0 ? "danger" : "good",
            },
          ]}
        />

        <AdminToolbar className="mt-4">
          <div className="relative min-w-0 flex-1 md:max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search user, email, address, city, or method"
              className="border-white/10 bg-black/20 pl-9 text-white placeholder:text-white/30"
            />
          </div>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[12rem] border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {FILTER_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {readable(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="hidden text-xs text-white/35 xl:inline">
              {filteredVerifications.length} shown
            </span>
          </div>
        </AdminToolbar>

        {filteredVerifications.length ? (
          <AdminList className="mt-4">
            {filteredVerifications.map((item) => {
              const verification = item.verification;
              const remaining = daysRemaining(verification.deadline);
              const overdue = remaining !== null && remaining < 0;
              return (
                <div
                  key={verification.id}
                  className="grid gap-4 px-3 py-4 sm:px-4 xl:grid-cols-[minmax(13rem,1fr)_minmax(18rem,1.35fr)_minmax(10rem,0.75fr)_minmax(10rem,0.75fr)_auto] xl:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 shrink-0 text-orange-300" />
                      <p className="truncate font-semibold text-white">{displayName(item.user)}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-white/38">{item.user.email}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white/72">
                      {verification.fullAddress || "Address line missing"}
                    </p>
                    <p className="mt-1 truncate text-xs text-white/38">
                      {[verification.city, verification.state, verification.zipCode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>

                  <div className="min-w-0 text-sm text-white/58">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                      Method
                    </p>
                    <p className="mt-1 flex items-center gap-2 truncate">
                      <MethodIcon method={verification.verificationMethod} />
                      {readable(verification.verificationMethod || "not recorded")}
                    </p>
                  </div>

                  <div className="min-w-0 text-sm text-white/58">
                    <div className="flex flex-wrap items-center gap-2">
                      {statusBadge(verification.status)}
                    </div>
                    <p
                      className={`mt-2 flex items-center gap-1.5 text-xs ${
                        overdue ? "text-red-200" : remaining !== null && remaining <= 3 ? "text-amber-200" : "text-white/38"
                      }`}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {remaining === null
                        ? "No valid deadline"
                        : overdue
                          ? `${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} overdue`
                          : `${remaining} day${remaining === 1 ? "" : "s"} remaining`}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openReview(item)}
                    className="border-white/12 bg-transparent text-white/65 hover:bg-white/[0.05] hover:text-white"
                  >
                    Review
                  </Button>
                </div>
              );
            })}
          </AdminList>
        ) : (
          <AdminEmptyState
            title="No address verifications match these filters"
            description="Change the search or status filter to inspect another part of the queue."
          />
        )}
      </AdminSection>

      <Dialog
        open={Boolean(selectedVerification)}
        onOpenChange={(open) => {
          if (!open) setSelectedVerification(null);
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto border-white/12 bg-[#101112] text-white sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="text-white">Review address verification</DialogTitle>
            <DialogDescription className="text-white/48">
              Save only the verification decision and admin notes shown here.
            </DialogDescription>
          </DialogHeader>

          {selectedVerification ? (
            <div className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                    User
                  </p>
                  <p className="mt-2 font-semibold text-white">
                    {displayName(selectedVerification.user)}
                  </p>
                  <p className="mt-1 text-sm text-white/45">{selectedVerification.user.email}</p>
                </section>
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                    Current state
                  </p>
                  <div className="mt-2">
                    {statusBadge(selectedVerification.verification.status)}
                  </div>
                </section>
              </div>

              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  Address
                </p>
                <div className="mt-2 border-y border-white/10 py-4 text-sm leading-6 text-white/68">
                  <p>{selectedVerification.verification.fullAddress}</p>
                  <p>
                    {[
                      selectedVerification.verification.city,
                      selectedVerification.verification.state,
                      selectedVerification.verification.zipCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </section>

              <div className="grid gap-5 sm:grid-cols-2">
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                    Method
                  </p>
                  <p className="mt-2 text-sm text-white/62">
                    {readable(selectedVerification.verification.verificationMethod || "not recorded")}
                  </p>
                </section>
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                    Deadline
                  </p>
                  <p className="mt-2 text-sm text-white/62">
                    {formatDate(selectedVerification.verification.deadline)}
                  </p>
                </section>
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                    Submitted
                  </p>
                  <p className="mt-2 text-sm text-white/62">
                    {formatDate(selectedVerification.verification.submittedAt)}
                  </p>
                </section>
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                    User address flag
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-white/62">
                    {selectedVerification.user.addressVerified ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-200" />
                    )}
                    {selectedVerification.user.addressVerified ? "Verified" : "Not verified"}
                  </p>
                </section>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="address-review-status" className="text-white/70">
                    Review decision
                  </Label>
                  <Select
                    value={reviewStatus}
                    onValueChange={(value) => setReviewStatus(value as ReviewStatus)}
                  >
                    <SelectTrigger id="address-review-status" className="border-white/10 bg-black/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address-review-notes" className="text-white/70">
                    Admin notes
                  </Label>
                  <Textarea
                    id="address-review-notes"
                    value={adminNotes}
                    onChange={(event) => setAdminNotes(event.target.value)}
                    placeholder="Record why the decision was made or what evidence is still needed."
                    className="min-h-28 border-white/10 bg-black/20 text-white"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedVerification(null)}
              className="border-white/12 bg-transparent text-white/65"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitReview}
              disabled={updateVerificationMutation.isPending || !selectedVerification}
              className="bg-orange-500 text-black hover:bg-orange-400"
            >
              {updateVerificationMutation.isPending ? "Saving…" : "Save decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminWorkspace>
  );
}
