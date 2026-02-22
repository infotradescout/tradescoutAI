import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BriefcaseBusiness, UserRoundSearch, Sparkles, X } from "lucide-react";

type EmploymentPostType = "job" | "resume";
type EmploymentPostStatus = "open" | "closed";

type EmploymentPost = {
  id: string;
  postType: EmploymentPostType;
  status: EmploymentPostStatus | string | null;
  title: string;
  body: string;
  countyFips: string;
  stateCode?: string | null;
  city?: string | null;
  tradeId?: string | null;
  payMin?: string | number | null;
  payMax?: string | number | null;
  payUnit?: string | null;
  isOwner?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function formatPay(post: EmploymentPost): string | null {
  const unit = String(post.payUnit || "").trim();
  const minRaw = post.payMin;
  const maxRaw = post.payMax;
  const min = minRaw == null ? null : Number(minRaw);
  const max = maxRaw == null ? null : Number(maxRaw);
  if (!Number.isFinite(min as number) && !Number.isFinite(max as number)) return null;

  const fmt = (v: number) =>
    v >= 1000 && unit === "year" ? `$${Math.round(v).toLocaleString()}/yr` : `$${v}`;

  const suffix = unit === "hour" ? "/hr" : unit === "month" ? "/mo" : unit === "year" ? "/yr" : "";

  if (Number.isFinite(min as number) && Number.isFinite(max as number)) {
    if (min === max) return `${fmt(min as number)}${suffix}`;
    return `${fmt(min as number)} – ${fmt(max as number)}${suffix}`;
  }
  if (Number.isFinite(min as number)) return `${fmt(min as number)}${suffix}`;
  if (Number.isFinite(max as number)) return `${fmt(max as number)}${suffix}`;
  return null;
}

export function EmploymentBoard({ defaultCountyFips }: { defaultCountyFips?: string }) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [active, setActive] = useState<EmploymentPostType>("job");
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | undefined>(
    defaultCountyFips || user?.countyFips || undefined
  );
  const [showCountySelector, setShowCountySelector] = useState(false);

  const [q, setQ] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<string>("");

  const [postOpen, setPostOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [city, setCity] = useState("");
  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [payUnit, setPayUnit] = useState<"hour" | "year" | "month" | "project">("hour");

  const searchParams = useMemo(() => {
    const parts = String(typeof window !== "undefined" ? window.location.search : "").replace(
      /^\?/,
      ""
    );
    return new URLSearchParams(parts);
  }, []);

  useEffect(() => {
    const tab = (searchParams.get("tab") || "").toLowerCase();
    if (tab === "resumes") setActive("resume");
    if (tab === "jobs") setActive("job");
    if (searchParams.get("mode") === "post") setPostOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!defaultCountyFips) return;
    setSelectedCountyFips((prev) => prev || defaultCountyFips);
  }, [defaultCountyFips]);

  const { data: trades = [] } = useQuery({
    queryKey: ["/api/trades"],
    queryFn: async () => apiRequest("GET", "/api/trades"),
  });

  const postsQueryKey = useMemo(
    () => ["/api/employment/posts", active, selectedCountyFips || null, selectedTrade || null, q],
    [active, selectedCountyFips, selectedTrade, q]
  );

  const { data: posts = [], isLoading } = useQuery<EmploymentPost[]>({
    queryKey: postsQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("type", active);
      if (selectedCountyFips) params.set("countyFips", selectedCountyFips);
      if (selectedTrade) params.set("tradeId", selectedTrade);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/employment/posts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch employment posts");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("Sign in to post.");
      if (!selectedCountyFips) throw new Error("Set a county first.");
      const nextPayMin = payMin.trim().length ? Number(payMin) : undefined;
      const nextPayMax = payMax.trim().length ? Number(payMax) : undefined;
      if (nextPayMin != null && !Number.isFinite(nextPayMin))
        throw new Error("Pay min is invalid.");
      if (nextPayMax != null && !Number.isFinite(nextPayMax))
        throw new Error("Pay max is invalid.");
      return apiRequest("POST", "/api/employment/posts", {
        postType: active,
        title: title.trim(),
        body: body.trim(),
        countyFips: selectedCountyFips,
        city: city.trim() || undefined,
        tradeId: selectedTrade || undefined,
        payMin: nextPayMin,
        payMax: nextPayMax,
        payUnit: payUnit,
      });
    },
    onSuccess: () => {
      toast({
        title: active === "job" ? "Job posted" : "Resume posted",
        description: "People can browse it, but contact stays Scout-gated.",
      });
      setPostOpen(false);
      setTitle("");
      setBody("");
      setCity("");
      setPayMin("");
      setPayMax("");
      queryClient.invalidateQueries({ queryKey: ["/api/employment/posts"] });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't post",
        description: String(err?.message || "Please try again."),
        variant: "destructive",
      });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/employment/posts/${id}/close`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employment/posts"] });
    },
  });

  const openScout = (post: EmploymentPost) => {
    const prompt =
      post.postType === "job"
        ? `I want to apply to this job. Help me confirm intent and take the next step.\n\nJob: ${post.title}\n\nDetails: ${post.body}`
        : `I want to reach out about this resume. Help me confirm intent and take the next step.\n\nResume headline: ${post.title}\n\nSummary: ${post.body}`;

    const params = new URLSearchParams();
    params.set("intent", "employment");
    params.set("source", "employment_post");
    params.set("postId", post.id);
    params.set("prompt", prompt);
    navigate(`/scout?${params.toString()}`);
  };

  const headerCopy =
    active === "job"
      ? "Post and browse employment opportunities. No spam: contact stays intent-gated through Scout."
      : "Post and browse people looking for work. No spam: contact stays intent-gated through Scout.";

  return (
    <div className="space-y-4">
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-[11px] text-[color:var(--text-secondary)]">
                <Sparkles className="h-4 w-4" />
                County-scoped board{" "}
                <span className="rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2 py-0.5 text-[10px] text-[color:var(--text-secondary)]">
                  {selectedCountyFips || "County not set"}
                </span>
              </div>
              <div className="text-sm text-[color:var(--text-secondary)]">{headerCopy}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCountySelector(true)}
                className="h-10"
              >
                {selectedCountyFips ? "Change county" : "Set county"}
              </Button>

              <div className="min-w-[220px]">
                <Label className="text-[11px] uppercase tracking-[0.12em] text-tsTextMuted">
                  Trade
                </Label>
                <Select
                  value={selectedTrade || "none"}
                  onValueChange={(v) => setSelectedTrade(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by trade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All trades</SelectItem>
                    {(trades as any[]).map((t) => (
                      <SelectItem key={t.slug} value={t.slug}>
                        {t.name || t.slug}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[220px]">
                <Label className="text-[11px] uppercase tracking-[0.12em] text-tsTextMuted">
                  Search
                </Label>
                <div className="flex items-center gap-2">
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keywords…" />
                  {q.trim().length > 0 && (
                    <Button size="icon" variant="ghost" onClick={() => setQ("")} aria-label="Clear">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <Button
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate(
                      `/pre-scout-setup?mode=signin&next=${encodeURIComponent(
                        "/direct-connect/employment"
                      )}`
                    );
                    return;
                  }
                  setPostOpen(true);
                }}
              >
                {active === "job" ? "Post a job" : "Post a resume"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={active}
        onValueChange={(v) => setActive(v as EmploymentPostType)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="job" className="gap-2">
            <BriefcaseBusiness className="h-4 w-4" />
            Hiring
          </TabsTrigger>
          <TabsTrigger value="resume" className="gap-2">
            <UserRoundSearch className="h-4 w-4" />
            Resumes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="job" className="space-y-3">
          {isLoading ? (
            <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <CardContent className="p-4 text-sm text-[color:var(--text-secondary)]">
                Loading…
              </CardContent>
            </Card>
          ) : (
            <PostList
              posts={posts}
              onAskScout={openScout}
              onClose={(id) => closeMutation.mutate(id)}
              canClose={Boolean(isAuthenticated)}
            />
          )}
        </TabsContent>

        <TabsContent value="resume" className="space-y-3">
          {isLoading ? (
            <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <CardContent className="p-4 text-sm text-[color:var(--text-secondary)]">
                Loading…
              </CardContent>
            </Card>
          ) : (
            <PostList
              posts={posts}
              onAskScout={openScout}
              onClose={(id) => closeMutation.mutate(id)}
              canClose={Boolean(isAuthenticated)}
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{active === "job" ? "Post a job" : "Post a resume"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={active === "job" ? "Role title" : "Headline (role + experience)"}
              />
            </div>

            <div className="grid gap-2">
              <Label>Details</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[140px]"
                placeholder={
                  active === "job"
                    ? "Describe responsibilities, requirements, schedule, and what good looks like."
                    : "Describe what you do, what you’re looking for, and availability."
                }
              />
              <div className="text-xs text-[color:var(--text-muted)]">
                Don’t include phone/email. Contact stays intent-gated through Scout.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>City (optional)</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              </div>

              <div className="grid gap-2">
                <Label>Pay (optional)</Label>
                <div className="grid grid-cols-[1fr_1fr_120px] gap-2">
                  <Input
                    value={payMin}
                    onChange={(e) => setPayMin(e.target.value)}
                    placeholder="Min"
                  />
                  <Input
                    value={payMax}
                    onChange={(e) => setPayMax(e.target.value)}
                    placeholder="Max"
                  />
                  <Select value={payUnit} onValueChange={(v) => setPayUnit(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hour">/hr</SelectItem>
                      <SelectItem value="month">/mo</SelectItem>
                      <SelectItem value="year">/yr</SelectItem>
                      <SelectItem value="project">project</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPostOpen(false)}>
                Cancel
              </Button>
              <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? "Posting…" : "Post"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCountySelector} onOpenChange={setShowCountySelector}>
        <DialogContent className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <DialogHeader>
            <DialogTitle className="text-[color:var(--text-primary)]">Change your area</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-[color:var(--text-secondary)]">
            <p>
              Current county:{" "}
              <span className="font-semibold text-[color:var(--text-primary)]">
                {selectedCountyFips || "Not set"}
              </span>
            </p>
            <Input
              type="text"
              placeholder="Enter county FIPS code (e.g., 04013 for Maricopa, AZ)"
              defaultValue={selectedCountyFips || ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const next = (e.target as HTMLInputElement).value.trim();
                  if (next && next !== selectedCountyFips) {
                    setSelectedCountyFips(next);
                    setShowCountySelector(false);
                  }
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCountySelector(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const input = document.querySelector(
                    'input[placeholder="Enter county FIPS code (e.g., 04013 for Maricopa, AZ)"]'
                  ) as HTMLInputElement | null;
                  const next = input?.value.trim() || "";
                  if (next && next !== selectedCountyFips) {
                    setSelectedCountyFips(next);
                    setShowCountySelector(false);
                  }
                }}
              >
                Change area
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostList({
  posts,
  onAskScout,
  onClose,
  canClose,
}: {
  posts: EmploymentPost[];
  onAskScout: (post: EmploymentPost) => void;
  onClose: (id: string) => void;
  canClose: boolean;
}) {
  if (!posts.length) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-4 text-sm text-[color:var(--text-secondary)]">
          No posts yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => {
        const pay = formatPay(post);
        const closed = String(post.status || "").toLowerCase() === "closed";

        return (
          <Card
            key={post.id}
            className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]"
          >
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-[color:var(--text-primary)]">
                      {post.title}
                    </div>
                    {closed && <Badge variant="secondary">Closed</Badge>}
                    {post.tradeId && <Badge variant="outline">{post.tradeId}</Badge>}
                    {pay && <Badge variant="outline">{pay}</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                    County: {post.countyFips}
                    {post.city ? ` • ${post.city}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => onAskScout(post)}>
                    Ask Scout
                  </Button>
                  {canClose && post.isOwner && !closed && (
                    <Button size="sm" variant="ghost" onClick={() => onClose(post.id)}>
                      Close
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="whitespace-pre-line text-sm text-[color:var(--text-secondary)]">
                {post.body}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
