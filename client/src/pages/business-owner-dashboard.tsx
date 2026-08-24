import { useMemo } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Eye,
  FileText,
  Globe2,
  Inbox,
  MessageSquare,
  PackageCheck,
  Pencil,
  ReceiptText,
  Store,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type OwnedProfile = {
  id: string;
  slug?: string | null;
  displayName?: string | null;
  status?: "draft" | "published" | string | null;
};

type ProfileViewCounts = {
  total: number;
  last7Days: number;
  last30Days: number;
  totalLoads: number;
  last7DayLoads: number;
  last30DayLoads: number;
  metric: "estimated_unique_visitors";
};

type BookingRequest = {
  id: string;
  status: "requested" | "accepted" | "declined" | "cancelled" | "completed" | string;
  serviceLabel?: string | null;
  requestMessage?: string | null;
  requestedStartAt?: string | null;
  requestedEndAt?: string | null;
  timezone?: string | null;
  deliveryMode?: string | null;
  depositRequired?: boolean | null;
  depositAmountUsd?: string | number | null;
  paymentStatus?: string | null;
  createdAt?: string | null;
};

type AccountingSummary = {
  sourceAvailable?: boolean;
  lifetime: {
    invoiceCount: number;
    paidCount: number;
    unpaidCount: number;
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
    totalExpenses: number;
    netProfit: number;
  };
};

type JobFlow = {
  jobId: string;
  title: string;
  clientName: string | null;
  stage: string;
  totals?: {
    totalInvoiced?: number;
    totalPaid?: number;
    totalUnpaid?: number;
    totalExpenses?: number;
    net?: number;
  };
  updatedAt?: string | null;
};

type JobFlowsResponse = { jobs: JobFlow[] };

type DirectConnectInboxItem = {
  assignment?: { id?: string | null; status?: string | null } | null;
};

const TERMINAL_JOB_STAGES = new Set(["invoice_paid", "receipt_issued", "cancelled", "closed"]);

function formatCurrency(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatDateTime(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function bookingStatusClass(status: string): string {
  if (status === "accepted") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (status === "completed") return "border-blue-400/30 bg-blue-400/10 text-blue-300";
  if (status === "declined" || status === "cancelled") {
    return "border-white/10 bg-white/5 text-white/50";
  }
  return "border-ts-orange/30 bg-ts-orange/10 text-ts-orange";
}

export default function BusinessOwnerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const profilesQuery = useQuery<OwnedProfile[]>({
    queryKey: ["/api/profiles"],
    queryFn: () => apiRequest("GET", "/api/profiles"),
    staleTime: 60_000,
  });

  const primaryProfile = useMemo(() => {
    const profiles = profilesQuery.data || [];
    const activeProfileId = String(user?.activeProfileId || "");
    return (
      profiles.find((profile) => activeProfileId && profile.id === activeProfileId) ||
      profiles.find((profile) => profile.status === "published") ||
      profiles[0] ||
      null
    );
  }, [profilesQuery.data, user?.activeProfileId]);

  const profileViewsQuery = useQuery<ProfileViewCounts>({
    queryKey: ["/api/u", primaryProfile?.slug, "views"],
    queryFn: () => apiRequest("GET", `/api/u/${encodeURIComponent(primaryProfile!.slug!)}/views`),
    enabled: Boolean(primaryProfile?.slug && primaryProfile.status === "published"),
    staleTime: 30_000,
  });

  const bookingsQuery = useQuery<BookingRequest[]>({
    queryKey: ["/api/profile-booking/requests/incoming"],
    queryFn: () => apiRequest("GET", "/api/profile-booking/requests/incoming"),
    staleTime: 15_000,
  });

  const directConnectInboxQuery = useQuery<DirectConnectInboxItem[]>({
    queryKey: ["/api/direct-connect/inbox", "business-dashboard"],
    queryFn: () => apiRequest("GET", "/api/direct-connect/inbox"),
    staleTime: 15_000,
  });

  const jobsQuery = useQuery<JobFlowsResponse>({
    queryKey: ["/api/accounting/job-flows"],
    queryFn: () => apiRequest("GET", "/api/accounting/job-flows"),
    staleTime: 30_000,
  });

  const accountingQuery = useQuery<AccountingSummary>({
    queryKey: ["/api/accounting/reports/summary"],
    queryFn: () => apiRequest("GET", "/api/accounting/reports/summary"),
    staleTime: 30_000,
  });

  const updateBooking = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingRequest["status"] }) =>
      apiRequest("PATCH", `/api/profile-booking/requests/${encodeURIComponent(id)}/status`, {
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-booking/requests/incoming"] });
      toast({ title: "Booking updated" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Booking not updated",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const bookings = bookingsQuery.data || [];
  const activeBookings = bookings.filter((booking) => booking.status === "accepted");
  const jobs = jobsQuery.data?.jobs || [];
  const activeJobs = jobs.filter((job) => !TERMINAL_JOB_STAGES.has(job.stage));
  const directConnectRequests = (directConnectInboxQuery.data || []).filter((item) => {
    const assignmentId = String(item.assignment?.id || "");
    if (!assignmentId || assignmentId.startsWith("request-")) return false;
    const status = String(item.assignment?.status || "suggested").toLowerCase();
    return status === "suggested" || status === "invited";
  });
  const recentBookings = bookings
    .filter((booking) => !["declined", "cancelled"].includes(booking.status))
    .slice(0, 5);
  const recentJobs = jobs.slice(0, 5);

  const profileIsPublished = primaryProfile?.status === "published";
  const editProfileHref = primaryProfile?.slug
    ? `/u/${encodeURIComponent(primaryProfile.slug)}/edit`
    : "/profile";
  const profileHref = profileIsPublished
    ? `/u/${encodeURIComponent(primaryProfile!.slug!)}`
    : editProfileHref;

  const metrics = [
    {
      label: "Estimated visitors · 30 days",
      value:
        profileViewsQuery.isLoading || profilesQuery.isLoading
          ? "—"
          : profilesQuery.isError || profileViewsQuery.isError
            ? "Unavailable"
            : !profileIsPublished
              ? "Not published"
              : String(profileViewsQuery.data?.last30Days ?? 0),
      icon: Eye,
      href: profileHref,
    },
    {
      label: "Direct Connect · needs response",
      value: directConnectInboxQuery.isLoading
        ? "—"
        : directConnectInboxQuery.isError
          ? "Unavailable"
          : String(directConnectRequests.length),
      icon: Inbox,
      href: "/direct-connect/inbox",
    },
    {
      label: "Active jobs",
      value: jobsQuery.isLoading
        ? "—"
        : jobsQuery.isError
          ? "Unavailable"
          : String(activeJobs.length),
      icon: BriefcaseBusiness,
      href: "/finances/jobs",
    },
    {
      label: "Outstanding invoices",
      value: accountingQuery.isLoading
        ? "—"
        : accountingQuery.isError || accountingQuery.data?.sourceAvailable === false
          ? "Unavailable"
          : formatCurrency(accountingQuery.data?.lifetime?.unpaidAmount ?? 0),
      icon: CircleDollarSign,
      href: "/finances/invoices",
    },
  ];

  const tools = [
    { label: "Direct Connect inbox", href: "/direct-connect/inbox", icon: Inbox },
    { label: "Messages", href: "/messages", icon: MessageSquare },
    { label: "Clients", href: "/finances/clients", icon: Users },
    { label: "Jobs", href: "/finances/jobs", icon: BriefcaseBusiness },
    { label: "Estimates", href: "/finances/estimates", icon: ClipboardList },
    { label: "Invoices", href: "/finances/invoices", icon: ReceiptText },
    { label: "Books & records", href: "/finances/records", icon: FileText },
    { label: "Services & items", href: "/offer-services", icon: PackageCheck },
    { label: "Reports", href: "/finances/reports", icon: BarChart3 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ts-orange">
            <Store className="h-4 w-4" />
            Business control
          </div>
          <h1 className="text-3xl font-bold text-white">Run the work behind your profile</h1>
          <p className="mt-2 max-w-3xl text-white/60">
            These numbers come from your live profile, bookings, jobs, and books. Nothing here is
            estimated or demo data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="border-white/15 text-white">
            <Link href={profileHref}>
              <Globe2 className="mr-2 h-4 w-4" />
              {profileIsPublished
                ? "View public profile"
                : primaryProfile?.slug
                  ? "Finish public profile"
                  : "Create public profile"}
            </Link>
          </Button>
          {primaryProfile?.slug ? (
            <Button asChild className="bg-ts-orange text-white hover:bg-ts-orange-dark">
              <Link href={editProfileHref}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit profile & availability
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Live business totals"
      >
        {metrics.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="block">
            <Card className="h-full border-white/10 bg-tsCard transition-colors hover:border-ts-orange/35">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="mt-1 text-sm text-white/60">{label}</p>
                </div>
                <Icon className="h-7 w-7 text-ts-orange" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <div className="space-y-6">
          <Card id="bookings" className="border-white/10 bg-tsCard">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-white">Incoming bookings</CardTitle>
                <p className="mt-1 text-sm text-white/60">
                  Accept, decline, and complete requests made through your public profile.
                </p>
              </div>
              {activeBookings.length > 0 ? (
                <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                  {activeBookings.length} active
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {bookingsQuery.isLoading ? (
                <p className="py-6 text-center text-sm text-white/50">Loading bookings…</p>
              ) : bookingsQuery.isError ? (
                <p className="py-6 text-center text-sm text-red-300">
                  Booking requests are temporarily unavailable.
                </p>
              ) : recentBookings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/15 p-6 text-center">
                  <CalendarCheck className="mx-auto h-7 w-7 text-white/35" />
                  <p className="mt-2 text-sm font-medium text-white">No booking requests yet</p>
                  <p className="mt-1 text-sm text-white/50">
                    Turn on availability in your profile editor when you are ready to accept them.
                  </p>
                  <Button asChild variant="outline" className="mt-4 border-white/15 text-white">
                    <Link href={editProfileHref}>Manage availability</Link>
                  </Button>
                </div>
              ) : (
                recentBookings.map((booking) => {
                  const requestedAt =
                    formatDateTime(booking.requestedStartAt) || formatDateTime(booking.createdAt);
                  const depositPending =
                    booking.depositRequired === true && booking.paymentStatus !== "paid";
                  return (
                    <article
                      key={booking.id}
                      className="rounded-lg border border-white/10 bg-black/15 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-white">
                              {booking.serviceLabel || "Booking request"}
                            </h3>
                            <Badge className={bookingStatusClass(booking.status)}>
                              {booking.status}
                            </Badge>
                            {booking.depositRequired ? (
                              <Badge variant="outline" className="border-white/15 text-white/60">
                                Deposit {booking.paymentStatus || "pending"}
                              </Badge>
                            ) : null}
                          </div>
                          {requestedAt ? (
                            <p className="mt-1 text-sm text-white/60">{requestedAt}</p>
                          ) : null}
                          {booking.requestMessage ? (
                            <p className="mt-2 line-clamp-3 text-sm text-white/70">
                              {booking.requestMessage}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {booking.status === "requested" ? (
                            <>
                              {depositPending ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300/30 text-amber-200"
                                >
                                  Awaiting deposit
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-ts-orange text-white hover:bg-ts-orange-dark"
                                  disabled={updateBooking.isPending}
                                  onClick={() =>
                                    updateBooking.mutate({ id: booking.id, status: "accepted" })
                                  }
                                >
                                  Accept
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-white/15 text-white"
                                disabled={updateBooking.isPending}
                                onClick={() =>
                                  updateBooking.mutate({ id: booking.id, status: "declined" })
                                }
                              >
                                Decline
                              </Button>
                            </>
                          ) : booking.status === "accepted" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-400/30 text-emerald-300"
                              disabled={updateBooking.isPending}
                              onClick={() =>
                                updateBooking.mutate({ id: booking.id, status: "completed" })
                              }
                            >
                              <CheckCircle2 className="mr-1.5 h-4 w-4" />
                              Complete
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-tsCard">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-white">Current jobs</CardTitle>
                <p className="mt-1 text-sm text-white/60">
                  Estimates, invoices, payments, and records stay attached to the job.
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="border-white/15 text-white">
                <Link href="/finances/jobs">Open jobs</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {jobsQuery.isLoading ? (
                <p className="py-6 text-center text-sm text-white/50">Loading jobs…</p>
              ) : jobsQuery.isError ? (
                <p className="py-6 text-center text-sm text-red-300">
                  Jobs are temporarily unavailable.
                </p>
              ) : recentJobs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/15 p-6 text-center">
                  <BriefcaseBusiness className="mx-auto h-7 w-7 text-white/35" />
                  <p className="mt-2 text-sm font-medium text-white">No jobs recorded yet</p>
                  <Button asChild className="mt-4 bg-ts-orange text-white hover:bg-ts-orange-dark">
                    <Link href="/finances/estimates">Create an estimate</Link>
                  </Button>
                </div>
              ) : (
                recentJobs.map((job) => (
                  <Link
                    key={job.jobId}
                    href="/finances/jobs"
                    className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/15 p-3 hover:border-ts-orange/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{job.title}</p>
                      <p className="truncate text-sm text-white/50">
                        {job.clientName || "No client attached"} · {job.stage.replaceAll("_", " ")}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-white/70">
                      {formatCurrency(job.totals?.totalUnpaid ?? 0)} due
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="border-white/10 bg-tsCard">
            <CardHeader>
              <CardTitle className="text-white">Business tools</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {tools.map(({ label, href, icon: Icon }) => (
                <Button
                  key={href}
                  asChild
                  variant="outline"
                  className="justify-start border-white/10 text-white/75 hover:border-ts-orange/30 hover:text-white"
                >
                  <Link href={href}>
                    <Icon className="mr-2 h-4 w-4 text-ts-orange" />
                    {label}
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-tsCard">
            <CardHeader>
              <CardTitle className="text-white">Profile status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Public address</span>
                <span className="truncate text-right font-medium text-white">
                  {primaryProfile?.slug ? `/u/${primaryProfile.slug}` : "Not created"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Publishing</span>
                <Badge
                  className={
                    primaryProfile?.status === "published"
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : "border-white/10 bg-white/5 text-white/60"
                  }
                >
                  {primaryProfile?.status || "not started"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Lifetime estimated visitors</span>
                <span className="font-medium text-white">
                  {profileViewsQuery.isLoading
                    ? "—"
                    : profileViewsQuery.isError
                      ? "Unavailable"
                      : !profileIsPublished
                        ? "Not published"
                        : (profileViewsQuery.data?.total ?? 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
