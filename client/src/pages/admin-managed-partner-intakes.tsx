import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CircleCheckBig,
  ExternalLink,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRoundPlus,
  XCircle,
} from "lucide-react";
import {
  MANAGED_PARTNER_ARCHETYPES,
  MANAGED_PARTNER_CONTACT_MODES,
  MANAGED_PARTNER_CONTROL_MODES,
  MANAGED_PARTNER_EXPOSURE_MODES,
  MANAGED_PARTNER_INTAKE_PRIORITIES,
  MANAGED_PARTNER_INTAKE_STAGES,
  MANAGED_PARTNER_REQUEST_MODES,
  slugifyManagedPartnerName,
  type ManagedPartnerIntakeCreateInput,
  type ManagedPartnerIntakePriority,
  type ManagedPartnerIntakeRecord,
  type ManagedPartnerIntakeReport,
  type ManagedPartnerIntakeStage,
} from "@shared/managedPartnerIntake";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type IntakeMutationResponse = {
  item: ManagedPartnerIntakeRecord;
  warnings?: string[];
};

type IntakeEditorForm = {
  displayName: string;
  slug: string;
  sourceUrlsText: string;
  archetype: ManagedPartnerIntakeRecord["archetype"];
  controlMode: ManagedPartnerIntakeRecord["controlMode"];
  contactMode: ManagedPartnerIntakeRecord["contactMode"];
  exposureMode: ManagedPartnerIntakeRecord["exposureMode"];
  requestMode: ManagedPartnerIntakeRecord["requestMode"];
  requestRecipientSlug: string;
  expectedPrimaryCta: string;
  expectedPhone: string;
  expectedEmail: string;
  expectedNotificationEmail: string;
  relationshipLabel: string;
  notes: string;
  stage: ManagedPartnerIntakeStage;
  priority: ManagedPartnerIntakePriority;
  latestAction: string;
  blockerNote: string;
};

const EMPTY_FORM: IntakeEditorForm = {
  displayName: "",
  slug: "",
  sourceUrlsText: "",
  archetype: "contractor",
  controlMode: "tradescout_admin_controlled",
  contactMode: "tradescout_managed",
  exposureMode: "public",
  requestMode: "profile_request_flow",
  requestRecipientSlug: "",
  expectedPrimaryCta: "Start a Request",
  expectedPhone: "",
  expectedEmail: "",
  expectedNotificationEmail: "",
  relationshipLabel: "",
  notes: "",
  stage: "incoming",
  priority: "normal",
  latestAction: "",
  blockerNote: "",
};

const ACTIVE_BUILD_STAGES = new Set<ManagedPartnerIntakeStage>([
  "source_review",
  "profile_build",
  "routing_review",
]);

function readable(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stageLabel(stage: ManagedPartnerIntakeStage): string {
  const labels: Record<ManagedPartnerIntakeStage, string> = {
    incoming: "Incoming",
    source_review: "Source review",
    profile_build: "Profile build",
    routing_review: "Routing review",
    ready_to_publish: "Ready to publish",
    live: "Live",
    blocked: "Blocked",
    archived: "Archived",
  };
  return labels[stage];
}

function stageBadge(stage: ManagedPartnerIntakeStage) {
  if (stage === "live") {
    return (
      <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
        Live
      </Badge>
    );
  }
  if (stage === "blocked") {
    return (
      <Badge className="border-red-400/30 bg-red-400/10 text-red-200">
        Blocked
      </Badge>
    );
  }
  if (stage === "ready_to_publish") {
    return (
      <Badge className="border-sky-400/30 bg-sky-400/10 text-sky-100">
        Ready to publish
      </Badge>
    );
  }
  if (stage === "incoming") {
    return (
      <Badge className="border-ts-orange/30 bg-ts-orange/10 text-ts-orange">
        Incoming
      </Badge>
    );
  }
  return (
    <Badge className="border-white/15 bg-white/5 text-white/70">
      {stageLabel(stage)}
    </Badge>
  );
}

function priorityBadge(priority: ManagedPartnerIntakePriority) {
  const classes: Record<ManagedPartnerIntakePriority, string> = {
    urgent: "border-red-400/30 bg-red-400/10 text-red-200",
    high: "border-amber-400/30 bg-amber-400/10 text-amber-100",
    normal: "border-white/15 bg-white/5 text-white/65",
    low: "border-sky-400/20 bg-sky-400/5 text-sky-100",
  };
  return <Badge className={classes[priority]}>{readable(priority)}</Badge>;
}

function summaryCard(label: string, value: number, detail: string) {
  return (
    <Card className="border-white/10 bg-black/20">
      <CardContent className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {label}
        </p>
        <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
        <p className="mt-1 text-xs leading-5 text-white/50">{detail}</p>
      </CardContent>
    </Card>
  );
}

function recordToForm(item: ManagedPartnerIntakeRecord): IntakeEditorForm {
  return {
    displayName: item.displayName,
    slug: item.slug || "",
    sourceUrlsText: item.sourceUrls.join("\n"),
    archetype: item.archetype,
    controlMode: item.controlMode,
    contactMode: item.contactMode,
    exposureMode: item.exposureMode,
    requestMode: item.requestMode,
    requestRecipientSlug: item.requestRecipientSlug || "",
    expectedPrimaryCta: item.expectedPrimaryCta || "",
    expectedPhone: item.expectedPhone || "",
    expectedEmail: item.expectedEmail || "",
    expectedNotificationEmail: item.expectedNotificationEmail || "",
    relationshipLabel: item.relationshipLabel || "",
    notes: item.notes || "",
    stage: item.stage,
    priority: item.priority,
    latestAction: "",
    blockerNote: item.blockerNote || "",
  };
}

function formPayload(form: IntakeEditorForm): ManagedPartnerIntakeCreateInput {
  return {
    displayName: form.displayName,
    slug: form.slug,
    sourceUrls: form.sourceUrlsText
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean),
    archetype: form.archetype,
    controlMode: form.controlMode,
    contactMode: form.contactMode,
    exposureMode: form.exposureMode,
    requestMode: form.requestMode,
    requestRecipientSlug: form.requestRecipientSlug || null,
    expectedPrimaryCta: form.expectedPrimaryCta || null,
    expectedPhone: form.expectedPhone || null,
    expectedEmail: form.expectedEmail || null,
    expectedNotificationEmail: form.expectedNotificationEmail || null,
    relationshipLabel: form.relationshipLabel || null,
    notes: form.notes,
    stage: form.stage,
    priority: form.priority,
    latestAction: form.latestAction || null,
    blockerNote: form.blockerNote || null,
  };
}

export default function AdminManagedPartnerIntakesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState<IntakeEditorForm>(EMPTY_FORM);
  const [stageFilter, setStageFilter] = useState<"all" | ManagedPartnerIntakeStage>("all");
  const [search, setSearch] = useState("");

  const intakeQuery = useQuery({
    queryKey: ["/api/admin/managed-partner-intakes"],
    queryFn: async () =>
      (await apiRequest(
        "GET",
        "/api/admin/managed-partner-intakes"
      )) as ManagedPartnerIntakeReport,
    refetchInterval: 30_000,
  });

  const invalidateOperations = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/managed-partner-intakes"],
      }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/managed-partners"] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = formPayload(form);
      return editingId
        ? ((await apiRequest(
            "PATCH",
            `/api/admin/managed-partner-intakes/${editingId}`,
            payload
          )) as IntakeMutationResponse)
        : ((await apiRequest(
            "POST",
            "/api/admin/managed-partner-intakes",
            payload
          )) as IntakeMutationResponse);
    },
    onSuccess: async (response) => {
      await invalidateOperations();
      setEditorOpen(false);
      setEditingId(null);
      setSlugTouched(false);
      setForm(EMPTY_FORM);
      toast({
        title: response.item.stage === "live" ? "Partner moved live" : "Partner intake saved",
        description:
          response.warnings?.[0] ||
          `${response.item.displayName} is in ${stageLabel(response.item.stage).toLowerCase()}.`,
        variant: response.warnings?.length ? "destructive" : "default",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Partner intake was not saved",
        description: error instanceof Error ? error.message : "Review the intake details and try again.",
        variant: "destructive",
      });
    },
  });

  const quickUpdateMutation = useMutation({
    mutationFn: async ({
      item,
      patch,
    }: {
      item: ManagedPartnerIntakeRecord;
      patch: Partial<ManagedPartnerIntakeCreateInput>;
    }) =>
      (await apiRequest(
        "PATCH",
        `/api/admin/managed-partner-intakes/${item.id}`,
        patch
      )) as IntakeMutationResponse,
    onSuccess: async (response) => {
      await invalidateOperations();
      toast({
        title: "Partner queue updated",
        description:
          response.warnings?.[0] ||
          `${response.item.displayName} is now ${stageLabel(response.item.stage).toLowerCase()}.`,
        variant: response.warnings?.length ? "destructive" : "default",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Queue update failed",
        description: error instanceof Error ? error.message : "Review the partner state and try again.",
        variant: "destructive",
      });
    },
  });

  const report = intakeQuery.data;
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (report?.items || []).filter((item) => {
      if (stageFilter !== "all" && item.stage !== stageFilter) return false;
      if (!query) return true;
      return [
        item.displayName,
        item.slug,
        item.archetype,
        item.controlMode,
        item.contactMode,
        item.requestRecipientSlug,
        item.relationshipLabel,
        item.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [report?.items, search, stageFilter]);

  const beginCreate = () => {
    setEditingId(null);
    setSlugTouched(false);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  };

  const beginEdit = (
    item: ManagedPartnerIntakeRecord,
    stageOverride?: ManagedPartnerIntakeStage
  ) => {
    setEditingId(item.id);
    setSlugTouched(true);
    setForm({ ...recordToForm(item), stage: stageOverride || item.stage });
    setEditorOpen(true);
  };

  const updateForm = <Key extends keyof IntakeEditorForm>(
    key: Key,
    value: IntakeEditorForm[Key]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateDisplayName = (displayName: string) => {
    setForm((current) => ({
      ...current,
      displayName,
      slug: slugTouched ? current.slug : slugifyManagedPartnerName(displayName),
    }));
  };

  const quickStageChange = (
    item: ManagedPartnerIntakeRecord,
    stage: ManagedPartnerIntakeStage
  ) => {
    if (stage === "blocked") {
      beginEdit(item, "blocked");
      toast({
        title: "Add the blocker before saving",
        description: "The queue keeps the exact reason visible until the partner can move again.",
      });
      return;
    }
    quickUpdateMutation.mutate({
      item,
      patch: {
        stage,
        latestAction: `Moved to ${stageLabel(stage)}`,
      },
    });
  };

  return (
    <div className="space-y-4" data-testid="managed-partner-intake-queue">
      <Card className="border-white/10 bg-tsCard/95">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <UserRoundPlus className="h-5 w-5 text-ts-orange" />
              Partner Intake Queue
            </CardTitle>
            <CardDescription className="mt-2 max-w-3xl text-white/65">
              Add the next partner as soon as the relationship arrives. Source review, profile build,
              contact, routing, publication, and the existing live-profile audit continue at the same
              time.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => intakeQuery.refetch()}
              disabled={intakeQuery.isFetching}
              className="border-white/15 bg-black/20 text-white hover:bg-white/10"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${intakeQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh queue
            </Button>
            <Button type="button" onClick={beginCreate} className="bg-ts-orange text-black hover:bg-ts-orange/90">
              <Plus className="mr-2 h-4 w-4" />
              Add partner
            </Button>
          </div>
        </CardHeader>

        {report ? (
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {summaryCard("Tracked", report.summary.total, "Open intake records")}
              {summaryCard("Incoming", report.summary.incoming, "New relationships")}
              {summaryCard("In progress", report.summary.activeBuilds, "Research, build, or routing")}
              {summaryCard("Ready", report.summary.readyToPublish, "Waiting for publication")}
              {summaryCard("Live", report.summary.live, "Joined the live audit")}
              {summaryCard("Blocked", report.summary.blocked, "Needs a named decision")}
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search partner, source, relationship, or recipient"
                className="border-white/10 bg-black/25 text-white placeholder:text-white/35"
              />
              <Select
                value={stageFilter}
                onValueChange={(value) =>
                  setStageFilter(value as "all" | ManagedPartnerIntakeStage)
                }
              >
                <SelectTrigger className="border-white/10 bg-black/25 text-white">
                  <SelectValue placeholder="Filter stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {MANAGED_PARTNER_INTAKE_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stageLabel(stage)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-white/45">
              Last refreshed {new Date(report.generatedAt).toLocaleString()} · refreshes every 30 seconds
            </p>
          </CardContent>
        ) : null}
      </Card>

      {editorOpen ? (
        <Card className="border-ts-orange/25 bg-tsCard/95" data-testid="managed-partner-intake-editor">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-white">
                  {editingId ? "Update partner intake" : "Add incoming partner"}
                </CardTitle>
                <CardDescription className="mt-2 text-white/60">
                  Record what is known now. Unknown owner contact stays pending instead of being invented.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditorOpen(false)}
                className="text-white/60 hover:bg-white/10 hover:text-white"
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partner-display-name" className="text-white/80">Partner name</Label>
                <Input
                  id="partner-display-name"
                  value={form.displayName}
                  onChange={(event) => updateDisplayName(event.target.value)}
                  placeholder="Company or partner name"
                  className="border-white/10 bg-black/25 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-slug" className="text-white/80">Profile slug</Label>
                <Input
                  id="partner-slug"
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    updateForm("slug", slugifyManagedPartnerName(event.target.value));
                  }}
                  placeholder="company-name"
                  className="border-white/10 bg-black/25 text-white"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="partner-source-urls" className="text-white/80">Existing website and source links</Label>
                <Textarea
                  id="partner-source-urls"
                  value={form.sourceUrlsText}
                  onChange={(event) => updateForm("sourceUrlsText", event.target.value)}
                  placeholder="One public source URL per line"
                  className="min-h-24 border-white/10 bg-black/25 text-white"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-white/80">Profile type</Label>
                <Select value={form.archetype} onValueChange={(value) => updateForm("archetype", value as IntakeEditorForm["archetype"])}>
                  <SelectTrigger className="border-white/10 bg-black/25 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{MANAGED_PARTNER_ARCHETYPES.map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Profile control</Label>
                <Select value={form.controlMode} onValueChange={(value) => updateForm("controlMode", value as IntakeEditorForm["controlMode"])}>
                  <SelectTrigger className="border-white/10 bg-black/25 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{MANAGED_PARTNER_CONTROL_MODES.map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Contact handling</Label>
                <Select value={form.contactMode} onValueChange={(value) => updateForm("contactMode", value as IntakeEditorForm["contactMode"])}>
                  <SelectTrigger className="border-white/10 bg-black/25 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{MANAGED_PARTNER_CONTACT_MODES.map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Exposure</Label>
                <Select value={form.exposureMode} onValueChange={(value) => updateForm("exposureMode", value as IntakeEditorForm["exposureMode"])}>
                  <SelectTrigger className="border-white/10 bg-black/25 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{MANAGED_PARTNER_EXPOSURE_MODES.map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Request experience</Label>
                <Select value={form.requestMode} onValueChange={(value) => updateForm("requestMode", value as IntakeEditorForm["requestMode"])}>
                  <SelectTrigger className="border-white/10 bg-black/25 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{MANAGED_PARTNER_REQUEST_MODES.map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Priority</Label>
                <Select value={form.priority} onValueChange={(value) => updateForm("priority", value as ManagedPartnerIntakePriority)}>
                  <SelectTrigger className="border-white/10 bg-black/25 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{MANAGED_PARTNER_INTAKE_PRIORITIES.map((value) => <SelectItem key={value} value={value}>{readable(value)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partner-request-recipient" className="text-white/80">Operating request recipient slug</Label>
                <Input
                  id="partner-request-recipient"
                  value={form.requestRecipientSlug}
                  onChange={(event) => updateForm("requestRecipientSlug", slugifyManagedPartnerName(event.target.value))}
                  placeholder={form.slug || "Defaults to this partner"}
                  className="border-white/10 bg-black/25 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-primary-cta" className="text-white/80">Primary customer action</Label>
                <Input
                  id="partner-primary-cta"
                  value={form.expectedPrimaryCta}
                  onChange={(event) => updateForm("expectedPrimaryCta", event.target.value)}
                  placeholder="Start a Request"
                  className="border-white/10 bg-black/25 text-white"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="partner-relationship" className="text-white/80">Verified relationship</Label>
                <Input
                  id="partner-relationship"
                  value={form.relationshipLabel}
                  onChange={(event) => updateForm("relationshipLabel", event.target.value)}
                  placeholder="Example: Exclusive first-cut distribution through JW Stone"
                  className="border-white/10 bg-black/25 text-white"
                />
              </div>
            </div>

            <details className="rounded border border-white/10 bg-black/15 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-white/75">
                Contact override and routing details
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="partner-phone" className="text-white/70">Expected phone</Label>
                  <Input id="partner-phone" value={form.expectedPhone} onChange={(event) => updateForm("expectedPhone", event.target.value)} className="border-white/10 bg-black/25 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partner-email" className="text-white/70">Expected email</Label>
                  <Input id="partner-email" value={form.expectedEmail} onChange={(event) => updateForm("expectedEmail", event.target.value)} className="border-white/10 bg-black/25 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partner-notification-email" className="text-white/70">Notification email</Label>
                  <Input id="partner-notification-email" value={form.expectedNotificationEmail} onChange={(event) => updateForm("expectedNotificationEmail", event.target.value)} className="border-white/10 bg-black/25 text-white" />
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-white/45">
                Leave these blank for TradeScout-managed contact. The server applies the approved phone and inbox automatically.
              </p>
            </details>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partner-notes" className="text-white/80">What is known and what must be preserved</Label>
                <Textarea
                  id="partner-notes"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Company facts, profile expectations, owner boundaries, products, and public language"
                  className="min-h-32 border-white/10 bg-black/25 text-white"
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/80">Current stage</Label>
                  <Select value={form.stage} onValueChange={(value) => updateForm("stage", value as ManagedPartnerIntakeStage)}>
                    <SelectTrigger className="border-white/10 bg-black/25 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{MANAGED_PARTNER_INTAKE_STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stageLabel(stage)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {form.stage === "blocked" ? (
                  <div className="space-y-2">
                    <Label htmlFor="partner-blocker" className="text-red-100">Blocker</Label>
                    <Textarea
                      id="partner-blocker"
                      value={form.blockerNote}
                      onChange={(event) => updateForm("blockerNote", event.target.value)}
                      placeholder="Name the exact missing decision, contact, source, or routing fact"
                      className="min-h-24 border-red-400/25 bg-red-950/20 text-white"
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="partner-latest-action" className="text-white/80">Latest action</Label>
                  <Input
                    id="partner-latest-action"
                    value={form.latestAction}
                    onChange={(event) => updateForm("latestAction", event.target.value)}
                    placeholder="Optional plain-language update"
                    className="border-white/10 bg-black/25 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-5">
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} className="border-white/15 bg-transparent text-white hover:bg-white/10">
                Cancel
              </Button>
              <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-ts-orange text-black hover:bg-ts-orange/90">
                {saveMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CircleCheckBig className="mr-2 h-4 w-4" />}
                {editingId ? "Save intake" : "Add to queue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {intakeQuery.isLoading ? (
        <Card className="border-white/10 bg-black/20">
          <CardContent className="flex min-h-48 items-center justify-center text-white/60">
            <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
            Loading partner intake queue…
          </CardContent>
        </Card>
      ) : intakeQuery.isError ? (
        <Card className="border-red-400/20 bg-red-950/20">
          <CardContent className="p-6 text-red-100">
            <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5" />Partner intake queue unavailable</div>
            <p className="mt-2 text-sm text-red-100/70">Existing profiles remain live. Retry the queue without interrupting partner operations.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden border-white/10 bg-tsCard/95">
              <CardHeader className="border-b border-white/8 bg-black/15">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl text-white">{item.displayName}</CardTitle>
                    <CardDescription className="mt-1 text-white/50">/{item.slug || "slug pending"}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">{priorityBadge(item.priority)}{stageBadge(item.stage)}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded border border-white/8 bg-black/20 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Profile lane</p>
                    <p className="mt-3 text-white/75">{readable(item.archetype)}</p>
                    <p className="mt-2 text-white/55">{readable(item.controlMode)}</p>
                    <p className="mt-2 text-white/55">{readable(item.exposureMode)}</p>
                  </div>
                  <div className="rounded border border-white/8 bg-black/20 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Response lane</p>
                    <p className="mt-3 text-white/75">{readable(item.contactMode)}</p>
                    <p className="mt-2 text-white/55">{readable(item.requestMode)}</p>
                    <p className="mt-2 text-white/55">Requests → {item.requestRecipientSlug || item.slug}</p>
                  </div>
                </div>

                {item.relationshipLabel ? (
                  <div className="rounded border border-ts-orange/25 bg-ts-orange/5 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ts-orange">Verified relationship</p>
                    <p className="mt-2 text-sm leading-6 text-white/75">{item.relationshipLabel}</p>
                  </div>
                ) : null}

                {item.blockerNote ? (
                  <div className="flex items-start gap-3 rounded border border-red-400/20 bg-red-950/20 p-3 text-sm leading-6 text-red-100">
                    <XCircle className="mt-1 h-4 w-4 shrink-0" />
                    <span>{item.blockerNote}</span>
                  </div>
                ) : null}

                {item.notes ? <p className="text-sm leading-6 text-white/60">{item.notes}</p> : null}

                {item.sourceUrls.length ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Source presence</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.sourceUrls.map((url, index) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-9 items-center gap-2 rounded border border-white/12 bg-black/20 px-3 text-xs font-semibold text-white/75 hover:bg-white/10">
                          Source {index + 1}<ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-white/50">Stage</Label>
                    <Select value={item.stage} onValueChange={(value) => quickStageChange(item, value as ManagedPartnerIntakeStage)} disabled={quickUpdateMutation.isPending}>
                      <SelectTrigger className="border-white/10 bg-black/25 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>{MANAGED_PARTNER_INTAKE_STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stageLabel(stage)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-white/50">Priority</Label>
                    <Select value={item.priority} onValueChange={(value) => quickUpdateMutation.mutate({ item, patch: { priority: value as ManagedPartnerIntakePriority, latestAction: `Priority changed to ${readable(value)}` } })} disabled={quickUpdateMutation.isPending}>
                      <SelectTrigger className="border-white/10 bg-black/25 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>{MANAGED_PARTNER_INTAKE_PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{readable(priority)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded border border-white/8 bg-black/15 p-3 text-xs leading-5 text-white/50">
                  <p>{item.latestAction || "No action recorded yet."}</p>
                  <p className="mt-1">Updated {new Date(item.updatedAt).toLocaleString()}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => beginEdit(item)} className="border-white/15 bg-black/20 text-white hover:bg-white/10">
                    <Pencil className="mr-2 h-4 w-4" />Edit intake
                  </Button>
                  {item.stage === "live" && item.slug ? (
                    <a href={`/u/${encodeURIComponent(item.slug)}`} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-ts-orange px-4 text-sm font-semibold text-black transition hover:bg-ts-orange/90">
                      Open live profile<ArrowRight className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!intakeQuery.isLoading && !intakeQuery.isError && filteredItems.length === 0 ? (
        <Card className="border-white/10 bg-black/20">
          <CardContent className="p-8 text-center text-white/55">
            No partner intakes match this filter. New partners can be added without changing or pausing any live profile.
          </CardContent>
        </Card>
      ) : null}

      <div className="rounded border border-white/8 bg-black/15 p-4 text-xs leading-6 text-white/50">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-ts-orange" />
          <p>
            Moving an intake to <strong className="text-white/75">Live</strong> requires an active business,
            a published profile, and matching ownership. Once live, it joins the managed-profile health board
            automatically. A managed contact is normalized without changing company ownership.
          </p>
        </div>
      </div>
    </div>
  );
}
