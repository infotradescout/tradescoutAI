import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
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
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function readable(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    return <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Live</Badge>;
  }
  if (stage === "blocked") {
    return <Badge className="border-red-400/30 bg-red-400/10 text-red-200">Blocked</Badge>;
  }
  if (stage === "ready_to_publish") {
    return <Badge className="border-sky-400/30 bg-sky-400/10 text-sky-100">Ready to publish</Badge>;
  }
  if (stage === "incoming") {
    return (
      <Badge className="border-orange-400/30 bg-orange-400/10 text-orange-200">Incoming</Badge>
    );
  }
  return <Badge className="border-white/15 bg-white/5 text-white/65">{stageLabel(stage)}</Badge>;
}

function priorityBadge(priority: ManagedPartnerIntakePriority) {
  const classes: Record<ManagedPartnerIntakePriority, string> = {
    urgent: "border-red-400/30 bg-red-400/10 text-red-200",
    high: "border-amber-400/30 bg-amber-400/10 text-amber-100",
    normal: "border-white/15 bg-white/5 text-white/55",
    low: "border-sky-400/20 bg-sky-400/5 text-sky-100",
  };
  return <Badge className={classes[priority]}>{readable(priority)}</Badge>;
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
      (await apiRequest("GET", "/api/admin/managed-partner-intakes")) as ManagedPartnerIntakeReport,
    refetchInterval: 30_000,
  });

  const invalidateOperations = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/admin/managed-partner-intakes"] }),
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
      closeEditor();
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
        description: formatUserFacingErrorMessage(
          error,
          "Review the intake details and try again."
        ),
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
        description: formatUserFacingErrorMessage(error, "Review the partner state and try again."),
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

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setSlugTouched(false);
    setForm(EMPTY_FORM);
  };

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

  const quickStageChange = (item: ManagedPartnerIntakeRecord, stage: ManagedPartnerIntakeStage) => {
    if (stage === "blocked") {
      beginEdit(item, "blocked");
      toast({
        title: "Name the blocker before saving",
        description: "The queue keeps the exact reason visible until the partner can move again.",
      });
      return;
    }
    quickUpdateMutation.mutate({
      item,
      patch: { stage, latestAction: `Moved to ${stageLabel(stage)}` },
    });
  };

  return (
    <div className="space-y-6" data-testid="managed-partner-intake-queue">
      <AdminSection
        title="Partner intake"
        description="Capture a new relationship immediately, then move it through source review, profile build, routing, and release without stopping any live partner."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => intakeQuery.refetch()}
              disabled={intakeQuery.isFetching}
              className="border-white/12 bg-white/[0.025] text-white/65 hover:bg-white/[0.06] hover:text-white"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${intakeQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              type="button"
              onClick={beginCreate}
              className="bg-orange-500 text-black hover:bg-orange-400"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add partner
            </Button>
          </div>
        }
      >
        {report ? (
          <>
            <AdminSummaryStrip
              items={[
                {
                  label: "Incoming",
                  value: report.summary.incoming,
                  detail: `${report.summary.total} open intake records`,
                  tone: report.summary.incoming > 0 ? "warning" : "neutral",
                },
                {
                  label: "In progress",
                  value: report.summary.activeBuilds,
                  detail: "Source, profile, or routing work",
                },
                {
                  label: "Ready to publish",
                  value: report.summary.readyToPublish,
                  detail: `${report.summary.live} already live`,
                  tone: report.summary.readyToPublish > 0 ? "good" : "neutral",
                },
                {
                  label: "Blocked",
                  value: report.summary.blocked,
                  detail: "Requires a named decision",
                  tone: report.summary.blocked > 0 ? "danger" : "good",
                },
              ]}
            />

            <AdminToolbar className="mt-4">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search partner, source, relationship, or request recipient"
                className="min-w-0 border-white/10 bg-black/20 text-white placeholder:text-white/30 md:max-w-2xl"
              />
              <div className="flex items-center gap-3">
                <Select
                  value={stageFilter}
                  onValueChange={(value) =>
                    setStageFilter(value as "all" | ManagedPartnerIntakeStage)
                  }
                >
                  <SelectTrigger className="w-[12rem] border-white/10 bg-black/20 text-white">
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
                <span className="hidden text-xs text-white/35 xl:inline">
                  Updated {new Date(report.generatedAt).toLocaleString()}
                </span>
              </div>
            </AdminToolbar>
          </>
        ) : null}
      </AdminSection>

      {editorOpen ? (
        <section
          className="border-y border-orange-400/25 bg-orange-400/[0.035]"
          data-testid="managed-partner-intake-editor"
        >
          <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                {editingId ? "Update partner intake" : "Add incoming partner"}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/50">
                Record what is known now. Unknown owner contact stays pending instead of being
                invented.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={closeEditor}
              className="self-start text-white/50 hover:bg-white/[0.06] hover:text-white"
            >
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          </div>

          <div className="space-y-6 px-4 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Partner name" htmlFor="partner-display-name">
                <Input
                  id="partner-display-name"
                  value={form.displayName}
                  onChange={(event) => updateDisplayName(event.target.value)}
                  placeholder="Company or partner name"
                  className="border-white/10 bg-black/25 text-white"
                />
              </Field>
              <Field label="Profile slug" htmlFor="partner-slug">
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
              </Field>
              <Field
                label="Existing website and source links"
                htmlFor="partner-source-urls"
                className="md:col-span-2"
              >
                <Textarea
                  id="partner-source-urls"
                  value={form.sourceUrlsText}
                  onChange={(event) => updateForm("sourceUrlsText", event.target.value)}
                  placeholder="One public source URL per line"
                  className="min-h-24 border-white/10 bg-black/25 text-white"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label="Profile type"
                value={form.archetype}
                options={MANAGED_PARTNER_ARCHETYPES}
                onChange={(value) =>
                  updateForm("archetype", value as IntakeEditorForm["archetype"])
                }
              />
              <SelectField
                label="Profile control"
                value={form.controlMode}
                options={MANAGED_PARTNER_CONTROL_MODES}
                onChange={(value) =>
                  updateForm("controlMode", value as IntakeEditorForm["controlMode"])
                }
              />
              <SelectField
                label="Contact handling"
                value={form.contactMode}
                options={MANAGED_PARTNER_CONTACT_MODES}
                onChange={(value) =>
                  updateForm("contactMode", value as IntakeEditorForm["contactMode"])
                }
              />
              <SelectField
                label="Exposure"
                value={form.exposureMode}
                options={MANAGED_PARTNER_EXPOSURE_MODES}
                onChange={(value) =>
                  updateForm("exposureMode", value as IntakeEditorForm["exposureMode"])
                }
              />
              <SelectField
                label="Request experience"
                value={form.requestMode}
                options={MANAGED_PARTNER_REQUEST_MODES}
                onChange={(value) =>
                  updateForm("requestMode", value as IntakeEditorForm["requestMode"])
                }
              />
              <SelectField
                label="Priority"
                value={form.priority}
                options={MANAGED_PARTNER_INTAKE_PRIORITIES}
                onChange={(value) => updateForm("priority", value as ManagedPartnerIntakePriority)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Operating request recipient slug" htmlFor="partner-request-recipient">
                <Input
                  id="partner-request-recipient"
                  value={form.requestRecipientSlug}
                  onChange={(event) =>
                    updateForm(
                      "requestRecipientSlug",
                      slugifyManagedPartnerName(event.target.value)
                    )
                  }
                  placeholder={form.slug || "Defaults to this partner"}
                  className="border-white/10 bg-black/25 text-white"
                />
              </Field>
              <Field label="Primary customer action" htmlFor="partner-primary-cta">
                <Input
                  id="partner-primary-cta"
                  value={form.expectedPrimaryCta}
                  onChange={(event) => updateForm("expectedPrimaryCta", event.target.value)}
                  placeholder="Start a Request"
                  className="border-white/10 bg-black/25 text-white"
                />
              </Field>
              <Field
                label="Verified relationship"
                htmlFor="partner-relationship"
                className="md:col-span-2"
              >
                <Input
                  id="partner-relationship"
                  value={form.relationshipLabel}
                  onChange={(event) => updateForm("relationshipLabel", event.target.value)}
                  placeholder="Example: Exclusive first-cut distribution through JW Stone"
                  className="border-white/10 bg-black/25 text-white"
                />
              </Field>
            </div>

            <details className="border-y border-white/10 bg-black/10 px-3 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-white/65">
                Contact override and notification details
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Expected phone" htmlFor="partner-phone">
                  <Input
                    id="partner-phone"
                    value={form.expectedPhone}
                    onChange={(event) => updateForm("expectedPhone", event.target.value)}
                    className="border-white/10 bg-black/25 text-white"
                  />
                </Field>
                <Field label="Expected email" htmlFor="partner-email">
                  <Input
                    id="partner-email"
                    value={form.expectedEmail}
                    onChange={(event) => updateForm("expectedEmail", event.target.value)}
                    className="border-white/10 bg-black/25 text-white"
                  />
                </Field>
                <Field label="Notification email" htmlFor="partner-notification-email">
                  <Input
                    id="partner-notification-email"
                    value={form.expectedNotificationEmail}
                    onChange={(event) =>
                      updateForm("expectedNotificationEmail", event.target.value)
                    }
                    className="border-white/10 bg-black/25 text-white"
                  />
                </Field>
              </div>
              <p className="mt-3 text-xs leading-5 text-white/38">
                Leave these blank for TradeScout-managed contact. The server applies the approved
                phone and inbox automatically.
              </p>
            </details>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Known facts and boundaries" htmlFor="partner-notes">
                <Textarea
                  id="partner-notes"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Company facts, profile expectations, ownership boundaries, products, services, and public language"
                  className="min-h-36 border-white/10 bg-black/25 text-white"
                />
              </Field>
              <div className="space-y-4">
                <SelectField
                  label="Current stage"
                  value={form.stage}
                  options={MANAGED_PARTNER_INTAKE_STAGES}
                  labelForOption={stageLabel}
                  onChange={(value) => updateForm("stage", value as ManagedPartnerIntakeStage)}
                />
                {form.stage === "blocked" ? (
                  <Field label="Blocker" htmlFor="partner-blocker">
                    <Textarea
                      id="partner-blocker"
                      value={form.blockerNote}
                      onChange={(event) => updateForm("blockerNote", event.target.value)}
                      placeholder="Name the exact missing decision, contact, source, or routing fact"
                      className="min-h-24 border-red-400/25 bg-red-950/20 text-white"
                    />
                  </Field>
                ) : null}
                <Field label="Latest action" htmlFor="partner-latest-action">
                  <Input
                    id="partner-latest-action"
                    value={form.latestAction}
                    onChange={(event) => updateForm("latestAction", event.target.value)}
                    placeholder="Optional plain-language update"
                    className="border-white/10 bg-black/25 text-white"
                  />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditor}
                className="border-white/15 bg-transparent text-white/70 hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="bg-orange-500 text-black hover:bg-orange-400"
              >
                {saveMutation.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {editingId ? "Save intake" : "Add to queue"}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {intakeQuery.isLoading ? (
        <div className="flex min-h-52 items-center justify-center border-y border-white/10 text-sm text-white/50">
          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
          Loading partner intake…
        </div>
      ) : intakeQuery.isError ? (
        <div className="border-y border-red-400/20 bg-red-950/15 px-4 py-8 text-red-100">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5" />
            Partner intake unavailable
          </div>
          <p className="mt-2 text-sm text-red-100/70">
            Existing profiles remain live. Retry the queue without interrupting partner operations.
          </p>
        </div>
      ) : filteredItems.length ? (
        <AdminList>
          {filteredItems.map((item) => (
            <details key={item.id} className="group">
              <summary className="grid cursor-pointer list-none gap-3 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(15rem,1.35fr)_minmax(10rem,0.85fr)_minmax(12rem,0.95fr)_minmax(12rem,0.95fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-white">{item.displayName}</h3>
                    {stageBadge(item.stage)}
                    {priorityBadge(item.priority)}
                  </div>
                  <p className="mt-1 truncate text-xs text-white/38">
                    /{item.slug || "slug pending"}
                  </p>
                </div>
                <div className="min-w-0 text-sm text-white/60">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                    Profile lane
                  </p>
                  <p className="mt-1 truncate">{readable(item.archetype)}</p>
                  <p className="truncate text-xs text-white/38">{readable(item.controlMode)}</p>
                </div>
                <div className="min-w-0 text-sm text-white/60">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                    Response lane
                  </p>
                  <p className="mt-1 truncate">{readable(item.contactMode)}</p>
                  <p className="truncate text-xs text-white/38">
                    Requests → {item.requestRecipientSlug || item.slug}
                  </p>
                </div>
                <div className="min-w-0 text-sm text-white/60">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                    Latest action
                  </p>
                  <p className="mt-1 line-clamp-1">{item.latestAction || "No action recorded"}</p>
                  <p className="truncate text-xs text-white/38">
                    {new Date(item.updatedAt).toLocaleString()}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-white/35 transition-transform group-open:rotate-180" />
              </summary>

              <div className="border-t border-white/10 bg-white/[0.018] px-3 py-5 sm:px-4">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
                  <div className="space-y-5">
                    {item.relationshipLabel ? (
                      <div className="border-l-2 border-orange-400 bg-orange-400/5 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-200">
                          Verified relationship
                        </p>
                        <p className="mt-2 text-sm leading-6 text-white/65">
                          {item.relationshipLabel}
                        </p>
                      </div>
                    ) : null}

                    {item.blockerNote ? (
                      <div className="flex items-start gap-3 border-l-2 border-red-400 bg-red-400/5 px-4 py-3 text-sm leading-6 text-red-100">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{item.blockerNote}</span>
                      </div>
                    ) : null}

                    {item.notes ? (
                      <p className="text-sm leading-6 text-white/50">{item.notes}</p>
                    ) : null}

                    {item.sourceUrls.length ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                          Source presence
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.sourceUrls.map((url, index) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/12 bg-white/[0.025] px-3 text-xs font-semibold text-white/65 hover:bg-white/[0.06] hover:text-white"
                            >
                              Source {index + 1}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <SelectField
                      label="Stage"
                      value={item.stage}
                      options={MANAGED_PARTNER_INTAKE_STAGES}
                      labelForOption={stageLabel}
                      disabled={quickUpdateMutation.isPending}
                      onChange={(value) =>
                        quickStageChange(item, value as ManagedPartnerIntakeStage)
                      }
                    />
                    <SelectField
                      label="Priority"
                      value={item.priority}
                      options={MANAGED_PARTNER_INTAKE_PRIORITIES}
                      disabled={quickUpdateMutation.isPending}
                      onChange={(value) =>
                        quickUpdateMutation.mutate({
                          item,
                          patch: {
                            priority: value as ManagedPartnerIntakePriority,
                            latestAction: `Priority changed to ${readable(value)}`,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => beginEdit(item)}
                    className="border-white/12 bg-white/[0.025] text-white/70 hover:bg-white/[0.06] hover:text-white"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit intake
                  </Button>
                  {item.stage === "live" && item.slug ? (
                    <a
                      href={`/u/${encodeURIComponent(item.slug)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
                    >
                      Open live profile
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </div>
            </details>
          ))}
        </AdminList>
      ) : (
        <AdminEmptyState
          title="No partner intakes match this view"
          description="Add the next partner or change the filters. Live profiles continue operating independently."
          action={
            <Button
              type="button"
              onClick={beginCreate}
              className="bg-orange-500 text-black hover:bg-orange-400"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add partner
            </Button>
          }
        />
      )}

      <div className="flex items-start gap-3 border-y border-white/10 bg-white/[0.018] px-4 py-4 text-xs leading-6 text-white/45">
        <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-orange-300" />
        <p>
          Moving an intake to <strong className="text-white/70">Live</strong> requires an active
          business, a published profile, and matching ownership. Once live, it joins the profile
          health audit automatically. Managed contact normalization never transfers company
          ownership.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={htmlFor} className="text-white/65">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  labelForOption = readable,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  labelForOption?: (value: any) => string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-white/65">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="border-white/10 bg-black/25 text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labelForOption(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
