import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { Page, Section } from "@/components/layout/PagePrimitives";
import { StateCountySelector } from "@/components/state-county-selector";
import {
  BUILD_PHASES,
  PROPERTY_PARTICIPANT_ROLES,
  type PropertyParticipantRoleValue,
} from "@shared/propertyParticipantRoles";
import {
  trackPropertyBuildStarted,
  trackPropertyMilestoneAdded,
  trackPropertyParticipantInvited,
} from "@/lib/coreProductAnalytics";

const EVENT_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
] as const;

const DOCUMENT_TYPES = [
  { value: "permit", label: "Permit" },
  { value: "inspection_report", label: "Inspection report" },
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "photo", label: "Photo" },
  { value: "other", label: "Other" },
] as const;

function programIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("programId")?.trim() || null;
}

function inviteCodeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("invite")?.trim() || null;
}

function formatDateTime(value: unknown): string {
  const d = value ? new Date(String(value)) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PropertyBuild() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userState = user ? "authenticated" : "anonymous";

  const [programId, setProgramId] = useState<string | null>(() => programIdFromUrl());
  const [pendingInviteCode] = useState<string | null>(() => inviteCodeFromUrl());

  const acceptInviteMutation = useMutation({
    mutationFn: async (code: string) =>
      apiRequest("POST", `/api/property-programs/invites/${encodeURIComponent(code)}/accept`),
    onSuccess: (data: any) => {
      const pid = String(data?.participant?.propertyProgramId || "");
      toast({ title: "Invite accepted" });
      if (pid) {
        setProgramId(pid);
        const url = new URL(window.location.href);
        url.searchParams.delete("invite");
        url.searchParams.set("programId", pid);
        window.history.replaceState({}, "", url.toString());
      }
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't accept invite",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.toString());
    },
  });

  useEffect(() => {
    if (pendingInviteCode) acceptInviteMutation.mutate(pendingInviteCode);
  }, []);

  const homesQuery = useQuery({ queryKey: ["/api/homes"] });
  const homes = Array.isArray((homesQuery.data as any)?.homes)
    ? (homesQuery.data as any).homes
    : [];

  const programQuery = useQuery({
    queryKey: [programId ? `/api/property-programs/${programId}` : "/api/property-programs/_none"],
    enabled: Boolean(programId),
  });
  const program = (programQuery.data as any)?.program ?? null;
  const callerRole = (programQuery.data as any)?.callerRole ?? null;
  const callerPermissions = (programQuery.data as any)?.callerPermissions ?? {};
  const isOwnerOrPrimary = callerRole === "owner" || callerRole === "primary";
  const canAddEvents = isOwnerOrPrimary || Boolean(callerPermissions?.canAddEvents);
  const canAddDocuments = isOwnerOrPrimary || Boolean(callerPermissions?.canAddDocuments);

  const eventsQuery = useQuery({
    queryKey: [
      programId
        ? `/api/property-programs/${programId}/events`
        : "/api/property-programs/_none/events",
    ],
    enabled: Boolean(programId),
  });
  const events = Array.isArray((eventsQuery.data as any)?.events)
    ? (eventsQuery.data as any).events
    : [];

  const participantsQuery = useQuery({
    queryKey: [
      programId
        ? `/api/property-programs/${programId}/participants`
        : "/api/property-programs/_none/participants",
    ],
    enabled: Boolean(programId),
  });
  const participants = Array.isArray((participantsQuery.data as any)?.participants)
    ? (participantsQuery.data as any).participants
    : [];
  const pendingInvites = Array.isArray((participantsQuery.data as any)?.pendingInvites)
    ? (participantsQuery.data as any).pendingInvites
    : [];

  const documentsQuery = useQuery({
    queryKey: [
      programId
        ? `/api/property-programs/${programId}/documents`
        : "/api/property-programs/_none/documents",
    ],
    enabled: Boolean(programId),
  });
  const documents = Array.isArray((documentsQuery.data as any)?.documents)
    ? (documentsQuery.data as any).documents
    : [];

  const readinessQuery = useQuery({
    queryKey: [
      programId
        ? `/api/property-programs/${programId}/readiness`
        : "/api/property-programs/_none/readiness",
    ],
    enabled: Boolean(programId),
  });
  const readiness = (readinessQuery.data as any)?.snapshot ?? null;

  // --- Start a build ---
  const [linkMode, setLinkMode] = useState<"existing" | "new">("existing");
  const [selectedHomeId, setSelectedHomeId] = useState("");
  const [newAddress, setNewAddress] = useState({
    nickname: "",
    address1: "",
    city: "",
    zipCode: "",
  });
  const [newStateCode, setNewStateCode] = useState("");
  const [newCountyFips, setNewCountyFips] = useState("");

  const createProgramMutation = useMutation({
    mutationFn: async () => {
      if (linkMode === "existing") {
        if (!selectedHomeId) throw new Error("Select a home first");
        return apiRequest("POST", "/api/property-programs", {
          mode: "build",
          homeId: selectedHomeId,
        });
      }
      if (!newStateCode || !newCountyFips) throw new Error("Select a state and county");
      return apiRequest("POST", "/api/property-programs", {
        mode: "build",
        stateCode: newStateCode,
        countyFips: newCountyFips,
        addressJson: {
          nickname: newAddress.nickname.trim() || undefined,
          address1: newAddress.address1.trim() || undefined,
          city: newAddress.city.trim() || undefined,
          zipCode: newAddress.zipCode.trim() || undefined,
        },
      });
    },
    onSuccess: (data: any) => {
      const id = String(data?.program?.id || "");
      toast({ title: "Build started" });
      if (id) {
        trackPropertyBuildStarted({ propertyProgramId: id, userState });
        setProgramId(id);
        const url = new URL(window.location.href);
        url.searchParams.set("programId", id);
        window.history.replaceState({}, "", url.toString());
      }
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't start build",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  // --- Milestones ---
  const [newEvent, setNewEvent] = useState({
    title: "",
    phase: BUILD_PHASES[0].value as string,
    status: "done" as (typeof EVENT_STATUSES)[number]["value"],
    occurredAt: new Date().toISOString().slice(0, 10),
    costAmount: "",
    description: "",
  });

  const addEventMutation = useMutation({
    mutationFn: async () => {
      if (!programId) throw new Error("No active build");
      if (!newEvent.title.trim()) throw new Error("Title is required");
      return apiRequest("POST", `/api/property-programs/${programId}/events`, {
        actionType: "milestone",
        title: newEvent.title.trim(),
        phase: newEvent.phase,
        status: newEvent.status,
        occurredAt: new Date(newEvent.occurredAt).toISOString(),
        costAmount: newEvent.costAmount.trim() ? Number(newEvent.costAmount) : undefined,
        description: newEvent.description.trim() || undefined,
        source: "user",
        sourceSurface: "property_build",
      });
    },
    onSuccess: async () => {
      toast({ title: "Milestone added" });
      trackPropertyMilestoneAdded({ propertyProgramId: programId || "", userState });
      setNewEvent((prev) => ({ ...prev, title: "", costAmount: "", description: "" }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/property-programs/${programId}/events`] }),
        queryClient.invalidateQueries({
          queryKey: [`/api/property-programs/${programId}/readiness`],
        }),
      ]);
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't add milestone",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  // --- Documents ---
  const [docType, setDocType] = useState<(typeof DOCUMENT_TYPES)[number]["value"]>("other");
  const [docFile, setDocFile] = useState<File | null>(null);

  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      if (!programId) throw new Error("No active build");
      if (!docFile) throw new Error("Choose a file first");
      const { objectKey } = await uploadPrivateObject(docFile);
      return apiRequest("POST", `/api/property-programs/${programId}/documents`, {
        documentType: docType,
        objectKey,
      });
    },
    onSuccess: async () => {
      toast({ title: "Document added" });
      setDocFile(null);
      await queryClient.invalidateQueries({
        queryKey: [`/api/property-programs/${programId}/documents`],
      });
    },
    onError: (err: any) => {
      toast({
        title: "Upload failed",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  // --- Participants ---
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<PropertyParticipantRoleValue>("contractor");

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!programId) throw new Error("No active build");
      if (!inviteEmail.trim()) throw new Error("Email is required");
      return apiRequest("POST", `/api/property-programs/${programId}/participants/invite`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
    },
    onSuccess: async () => {
      toast({ title: "Invite sent" });
      trackPropertyParticipantInvited({
        propertyProgramId: programId || "",
        role: inviteRole,
        userState,
      });
      setInviteEmail("");
      await queryClient.invalidateQueries({
        queryKey: [`/api/property-programs/${programId}/participants`],
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't send invite",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      if (!programId) throw new Error("No active build");
      return apiRequest(
        "DELETE",
        `/api/property-programs/${programId}/participants/${participantId}`
      );
    },
    onSuccess: async () => {
      toast({ title: "Participant removed" });
      await queryClient.invalidateQueries({
        queryKey: [`/api/property-programs/${programId}/participants`],
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't remove participant",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const transferPrimaryMutation = useMutation({
    mutationFn: async (newPrimaryUserId: string) => {
      if (!programId) throw new Error("No active build");
      return apiRequest("POST", `/api/property-programs/${programId}/transfer-primary`, {
        newPrimaryUserId,
      });
    },
    onSuccess: async () => {
      toast({ title: "Primary contact transferred" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/property-programs/${programId}`] }),
        queryClient.invalidateQueries({
          queryKey: [`/api/property-programs/${programId}/participants`],
        }),
        queryClient.invalidateQueries({ queryKey: [`/api/property-programs/${programId}/events`] }),
      ]);
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't transfer primary",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const phaseLabel = useMemo(() => {
    const map = new Map<string, string>(BUILD_PHASES.map((p) => [p.value, p.label]));
    return (value: string) => map.get(value) || value;
  }, []);

  if (!programId) {
    return (
      <Page>
        <Section
          title="Build Your Own Home"
          subtitle="Track a new-construction build from groundbreaking to final CO — sharable with your contractors."
        >
          <Card>
            <CardHeader>
              <CardTitle>Start a build</CardTitle>
              <CardDescription>
                Link one of your existing HomeID homes, or start fresh with a new address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={linkMode === "existing" ? "default" : "outline"}
                  onClick={() => setLinkMode("existing")}
                >
                  Use an existing home
                </Button>
                <Button
                  type="button"
                  variant={linkMode === "new" ? "default" : "outline"}
                  onClick={() => setLinkMode("new")}
                >
                  New address
                </Button>
              </div>

              {linkMode === "existing" ? (
                <div className="space-y-2">
                  <Label>Home</Label>
                  <Select value={selectedHomeId} onValueChange={setSelectedHomeId}>
                    <SelectTrigger>
                      <SelectValue placeholder={homes.length ? "Select a home" : "No homes yet"} />
                    </SelectTrigger>
                    <SelectContent>
                      {homes.map((home: any) => (
                        <SelectItem key={home.id} value={String(home.id)}>
                          {home.nickname || home.address1 || "Home"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nickname</Label>
                      <Input
                        value={newAddress.nickname}
                        onChange={(e) => setNewAddress({ ...newAddress, nickname: e.target.value })}
                        placeholder="e.g. Maple Street build"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Street address</Label>
                      <Input
                        value={newAddress.address1}
                        onChange={(e) => setNewAddress({ ...newAddress, address1: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Zip code</Label>
                      <Input
                        value={newAddress.zipCode}
                        onChange={(e) => setNewAddress({ ...newAddress, zipCode: e.target.value })}
                      />
                    </div>
                  </div>
                  <StateCountySelector
                    selectedState={newStateCode}
                    selectedCounty={newCountyFips}
                    onStateChange={setNewStateCode}
                    onCountyChange={setNewCountyFips}
                  />
                </div>
              )}

              <Button
                onClick={() => createProgramMutation.mutate()}
                disabled={createProgramMutation.isPending}
              >
                {createProgramMutation.isPending ? "Starting..." : "Start build timeline"}
              </Button>
            </CardContent>
          </Card>
        </Section>
      </Page>
    );
  }

  return (
    <Page>
      <Section
        title={program?.addressJson?.nickname || program?.addressJson?.address1 || "Build Timeline"}
        subtitle={[program?.addressJson?.city, program?.stateCode].filter(Boolean).join(", ")}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Readiness</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {readiness ? `${readiness.readinessScore}` : "--"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{events.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Your role</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold capitalize">{callerRole || "-"}</div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Timeline" subtitle="Milestones logged for this build.">
        <Card>
          <CardContent className="space-y-4 pt-6">
            {canAddEvents && (
              <div className="space-y-3 rounded-md border border-[color:var(--surface-card-border)] p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      placeholder="e.g. Foundation poured"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phase</Label>
                    <Select
                      value={newEvent.phase}
                      onValueChange={(v) => setNewEvent({ ...newEvent, phase: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUILD_PHASES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={newEvent.status}
                      onValueChange={(v) => setNewEvent({ ...newEvent, status: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={newEvent.occurredAt}
                      onChange={(e) => setNewEvent({ ...newEvent, occurredAt: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cost (optional)</Label>
                    <Input
                      type="number"
                      value={newEvent.costAmount}
                      onChange={(e) => setNewEvent({ ...newEvent, costAmount: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  />
                </div>
                <Button
                  onClick={() => addEventMutation.mutate()}
                  disabled={addEventMutation.isPending}
                >
                  {addEventMutation.isPending ? "Adding..." : "Add milestone"}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {events.length === 0 && (
                <p className="text-sm text-[color:var(--text-secondary)]">
                  No milestones logged yet.
                </p>
              )}
              {events.map((event: any) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-1 border-b border-[color:var(--surface-card-border)] pb-2 last:border-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{event.title}</span>
                    <span className="text-xs text-[color:var(--text-secondary)]">
                      {formatDateTime(event.occurredAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-[color:var(--text-secondary)]">
                    {event.phase && <span>{phaseLabel(event.phase)}</span>}
                    <span className="capitalize">{event.status}</span>
                    {event.costAmount && <span>${event.costAmount}</span>}
                  </div>
                  {event.description && <p className="text-sm">{event.description}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Documents" subtitle="Permits, invoices, and photos tied to this build.">
        <Card>
          <CardContent className="space-y-4 pt-6">
            {canAddDocuments && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={docType} onValueChange={(v) => setDocType(v as any)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>File</Label>
                  <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                </div>
                <Button
                  onClick={() => uploadDocMutation.mutate()}
                  disabled={uploadDocMutation.isPending || !docFile}
                >
                  {uploadDocMutation.isPending ? "Uploading..." : "Upload"}
                </Button>
              </div>
            )}
            <div className="space-y-2">
              {documents.length === 0 && (
                <p className="text-sm text-[color:var(--text-secondary)]">No documents yet.</p>
              )}
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="capitalize">{doc.documentType?.replace(/_/g, " ")}</span>
                  <a
                    className="text-[color:var(--brand-accent,#2563eb)] underline"
                    href={buildApiUrl(
                      `/api/property-programs/${programId}/documents/${doc.id}/download`
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Participants" subtitle="Everyone with access to this build.">
        <Card>
          <CardContent className="space-y-4 pt-6">
            {isOwnerOrPrimary && (
              <div className="flex flex-wrap items-end gap-3 rounded-md border border-[color:var(--surface-card-border)] p-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="contractor@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as PropertyParticipantRoleValue)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_PARTICIPANT_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? "Sending..." : "Invite"}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {participants.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {p.firstName || p.lastName
                      ? `${p.firstName || ""} ${p.lastName || ""}`.trim()
                      : p.email}{" "}
                    <span className="text-xs capitalize text-[color:var(--text-secondary)]">
                      ({p.participantRole})
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {isOwnerOrPrimary &&
                      p.participantRole === "primary" &&
                      program?.ownerUserId !== p.userId && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title="Already the current primary contact"
                        >
                          Primary
                        </Button>
                      )}
                    {callerRole === "owner" &&
                      p.participantRole !== "owner" &&
                      p.participantRole !== "primary" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => transferPrimaryMutation.mutate(p.userId)}
                          disabled={transferPrimaryMutation.isPending}
                        >
                          Make primary
                        </Button>
                      )}
                    {isOwnerOrPrimary && p.participantRole !== "owner" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeParticipantMutation.mutate(p.id)}
                        disabled={removeParticipantMutation.isPending}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {pendingInvites.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-2 text-sm opacity-70"
                >
                  <span>
                    {inv.inviteeEmail}{" "}
                    <span className="text-xs capitalize text-[color:var(--text-secondary)]">
                      ({inv.participantRole}, pending)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Section>
    </Page>
  );
}
