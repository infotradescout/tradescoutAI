import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Page, Section } from "@/components/layout/PagePrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  AlertCircle,
  Briefcase,
  CheckCircle,
  Clock,
  DollarSign,
  ExternalLink,
  MapPin,
  User,
  Zap,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

function profileCompleteness(profile: any): { score: number; missing: string[] } {
  const checks: Array<[string, boolean]> = [
    ["Profile photo", Boolean(profile?.profileImageUrl)],
    ["Bio", Boolean(profile?.bio?.trim())],
    ["Skills listed", Array.isArray(profile?.skills) && profile.skills.length > 0],
    ["Hourly rate", Boolean(profile?.hourlyRate)],
    [
      "Availability set",
      Boolean(profile?.availableHours && Object.keys(profile.availableHours).length > 0),
    ],
    ["Transportation method", Boolean(profile?.transportationMethod)],
    ["ID verified", Boolean(profile?.isIdVerified)],
    [
      "Work experience",
      Array.isArray(profile?.workExperience) && profile.workExperience.length > 0,
    ],
  ];
  const done = checks.filter(([, v]) => v);
  const missing = checks.filter(([, v]) => !v).map(([label]) => label);
  return { score: Math.round((done.length / checks.length) * 100), missing };
}

function statusColor(status: string) {
  switch (status) {
    case "accepted":
    case "shortlisted":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "declined":
    case "rejected":
      return "bg-red-500/20 text-red-300 border-red-500/30";
    case "withdrawn":
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    default:
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  }
}

// ── sub-components ────────────────────────────────────────────────────────────

function ProfileCompletenessCard({ profile }: { profile: any }) {
  const { score, missing } = profileCompleteness(profile);
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-white/70 flex items-center gap-2">
          <User className="w-4 h-4" /> Profile Completeness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3 mb-3">
          <span className="text-3xl font-bold text-white">{score}%</span>
          {score === 100 && (
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-1">
              Complete
            </Badge>
          )}
        </div>
        <Progress value={score} className="h-2 mb-3" />
        {missing.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-white/50 mb-1">Still needed:</p>
            {missing.map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-white/60">
                <AlertCircle className="w-3 h-3 text-yellow-400 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        )}
        <Button
          asChild
          size="sm"
          variant="outline"
          className="mt-3 w-full border-white/20 text-white/80 hover:bg-white/10"
        >
          <Link href="/worker-marketplace">Edit Profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function StatsRow({ profile }: { profile: any }) {
  const stats = [
    {
      icon: <Briefcase className="w-4 h-4 text-blue-400" />,
      label: "Jobs Completed",
      value: profile?.totalJobsCompleted ?? 0,
    },
    {
      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
      label: "Identity",
      value: profile?.isIdVerified ? "Verified" : "Pending",
    },
    {
      icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
      label: "Total Earned",
      value: profile?.totalEarnings ? `$${Number(profile.totalEarnings).toLocaleString()}` : "$0",
    },
    {
      icon: <Zap className="w-4 h-4 text-purple-400" />,
      label: "Hourly Rate",
      value: profile?.hourlyRate ? `$${Number(profile.hourlyRate)}/hr` : "Not set",
    },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="bg-white/5 border-white/10">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              {s.icon}
              <span className="text-xs text-white/50">{s.label}</span>
            </div>
            <p className="text-xl font-semibold text-white">{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DCInboxTab() {
  const { data: inbox, isLoading } = useQuery<any[]>({
    queryKey: ["/api/direct-connect/inbox"],
    queryFn: () => apiRequest("GET", "/api/direct-connect/inbox").then((r) => r.json()),
  });

  const qc = useQueryClient();
  const respondMutation = useMutation({
    mutationFn: ({
      assignmentId,
      decision,
      availabilityWindow,
      priceBand,
      scopeNote,
    }: {
      assignmentId: string;
      decision: "accept" | "decline";
      availabilityWindow?: string;
      priceBand?: string;
      scopeNote?: string;
    }) =>
      apiRequest("POST", `/api/direct-connect/assignments/${assignmentId}/respond`, {
        decision,
        availabilityWindow,
        priceBand,
        scopeNote,
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/direct-connect/inbox"] }),
  });

  if (isLoading) return <p className="text-white/40 text-sm py-4">Loading requests…</p>;
  const items = (inbox ?? []).filter((i: any) => i.assignment?.status === "suggested");
  if (!items.length)
    return (
      <p className="text-white/40 text-sm py-4">No pending requests right now. Check back soon.</p>
    );

  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <Card key={item.assignment.id} className="bg-white/5 border-white/10">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                  {item.request?.title ?? "Untitled request"}
                </p>
                <p className="text-sm text-white/50 line-clamp-2 mt-0.5">
                  {item.request?.description ?? ""}
                </p>
                {item.request?.countyFips && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-white/40">
                    <MapPin className="w-3 h-3" />
                    {item.request.countyFips}
                  </div>
                )}
              </div>
              <Badge className={statusColor(item.assignment.status)}>
                {item.assignment.status}
              </Badge>
            </div>
            <Separator className="my-3 bg-white/10" />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={respondMutation.isPending}
                onClick={() =>
                  respondMutation.mutate({
                    assignmentId: item.assignment.id,
                    decision: "accept",
                    availabilityWindow: "Within 24 hours",
                    priceBand: "standard",
                    scopeNote: "Happy to help with this task.",
                  })
                }
                data-testid="helper-dc-accept-btn"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 text-white/70 hover:bg-white/10"
                disabled={respondMutation.isPending}
                onClick={() =>
                  respondMutation.mutate({
                    assignmentId: item.assignment.id,
                    decision: "decline",
                  })
                }
              >
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ApplicationsTab() {
  const { data: apps, isLoading } = useQuery<any[]>({
    queryKey: ["/api/employment/my-applications"],
    queryFn: () => apiRequest("GET", "/api/employment/my-applications").then((r) => r.json()),
  });

  const qc = useQueryClient();
  const withdrawMutation = useMutation({
    mutationFn: (appId: string) =>
      apiRequest("PATCH", `/api/employment/applications/${appId}`, {
        status: "withdrawn",
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/employment/my-applications"] }),
  });

  if (isLoading) return <p className="text-white/40 text-sm py-4">Loading applications…</p>;
  if (!apps?.length)
    return (
      <div className="text-center py-8">
        <p className="text-white/40 text-sm mb-3">No job applications yet.</p>
        <Button asChild size="sm" variant="outline" className="border-white/20 text-white/70">
          <Link href="/direct-connect">Browse Jobs</Link>
        </Button>
      </div>
    );

  return (
    <div className="space-y-3">
      {apps.map((app: any) => (
        <Card key={app.id} className="bg-white/5 border-white/10">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{app.post?.title ?? "Job Post"}</p>
                {app.post?.businessName && (
                  <p className="text-xs text-white/50 mt-0.5">{app.post.businessName}</p>
                )}
                {app.post?.location && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-white/40">
                    <MapPin className="w-3 h-3" />
                    {app.post.location}
                  </div>
                )}
                {app.post?.payRate && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-white/40">
                    <DollarSign className="w-3 h-3" />
                    {app.post.payRate}
                  </div>
                )}
              </div>
              <Badge className={statusColor(app.status)}>{app.status}</Badge>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Clock className="w-3 h-3 text-white/30" />
              <span className="text-xs text-white/30">
                Applied {new Date(app.createdAt).toLocaleDateString()}
              </span>
              {app.status === "pending" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-xs text-white/40 hover:text-white/70 h-6 px-2"
                  onClick={() => withdrawMutation.mutate(app.id)}
                  disabled={withdrawMutation.isPending}
                >
                  Withdraw
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AvailabilityBadge({ profile }: { profile: any }) {
  const isAvailable = profile?.isAvailable;
  const qc = useQueryClient();
  const toggleMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", "/api/workers/profile/availability", {
        isAvailable: !isAvailable,
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/workers/profile"] }),
  });
  return (
    <button
      onClick={() => toggleMutation.mutate()}
      disabled={toggleMutation.isPending}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        isAvailable
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30"
          : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/30"
      }`}
      data-testid="helper-availability-toggle"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isAvailable ? "bg-emerald-400" : "bg-zinc-500"}`}
      />
      {isAvailable ? "Available for work" : "Not available"}
    </button>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function HelperDashboard() {
  const { user } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["/api/workers/profile"],
    queryFn: () => apiRequest("GET", "/api/workers/profile").then((r) => r.json()),
    retry: false,
  });

  const noProfile = !profileLoading && (!profile?.id || (profile as any)?.message);

  return (
    <Page className="max-w-5xl">
      <Section
        title="Helper Dashboard"
        subtitle={
          profile?.id
            ? `Welcome back, ${profile.firstName}!`
            : "Manage your tasks and grow your reputation"
        }
      >
        {/* Role check for non-helpers */}
        {user?.role && user.role !== "helper" && user.role !== "admin" && (
          <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-white/50 text-sm">
              This dashboard is for helpers. Your current role is:{" "}
              <span className="text-white/80">{String(user.role)}</span>
            </p>
          </div>
        )}

        {/* Availability toggle + verification badge */}
        {profile?.id && (
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <AvailabilityBadge profile={profile} />
            {profile.verificationStatus === "approved" && (
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                <CheckCircle className="w-3 h-3 mr-1" /> Verified
              </Badge>
            )}
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="ml-auto text-white/50 hover:text-white/80"
            >
              <Link href={`/helpers/${profile.id}`}>
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> View Public Profile
              </Link>
            </Button>
          </div>
        )}

        {/* No profile state */}
        {noProfile && (
          <Card className="bg-yellow-500/10 border-yellow-500/20 mb-6">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">No helper profile found</p>
                  <p className="text-xs text-white/50 mt-0.5">
                    Register as a helper to start receiving job requests and applying for
                    opportunities.
                  </p>
                  <Button
                    asChild
                    size="sm"
                    className="mt-3 bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    <Link href="/worker-marketplace">Create Helper Profile</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main content — only when profile exists */}
        {profile?.id && (
          <div className="space-y-6">
            <StatsRow profile={profile} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: profile completeness */}
              <div className="lg:col-span-1">
                <ProfileCompletenessCard profile={profile} />
              </div>

              {/* Right: tabs */}
              <div className="lg:col-span-2">
                <Tabs defaultValue="inbox">
                  <TabsList className="bg-white/5 border border-white/10 mb-4">
                    <TabsTrigger value="inbox" className="text-xs data-[state=active]:bg-white/10">
                      DC Requests
                    </TabsTrigger>
                    <TabsTrigger
                      value="applications"
                      className="text-xs data-[state=active]:bg-white/10"
                    >
                      Job Applications
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="inbox">
                    <DCInboxTab />
                  </TabsContent>
                  <TabsContent value="applications">
                    <ApplicationsTab />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        )}
      </Section>
    </Page>
  );
}
