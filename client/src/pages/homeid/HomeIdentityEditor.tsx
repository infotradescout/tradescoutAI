import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import {
  HOME_IDENTITY_FIELDS, HOME_IDENTITY_LABELS, HOME_IDENTITY_TYPES, HOME_LOCATION_FIELDS,
  homeIdentityChanges, homeIdentityDraft, homeIdentityUpdateSchema, parseHomeIdentitySnapshot,
  type HomeIdentityDraft, type HomeIdentityField, type HomeIdentitySnapshot, type HomeIdentityUpdate,
} from "@shared/homeIdentity";
import "./HomeIdentityEditor.css";

type Options = { code: string; name: string };
type County = { fips: string; name: string };
type Status = { dirty: boolean; pending: boolean };
type Props = { homeId: string; viewerId: string; triggerLabel?: string; className?: string };

function options<T>(value: unknown, key: "code" | "fips"): T[] {
  if (!Array.isArray(value) || value.some((row) => !row || typeof row.name !== "string" || typeof row[key] !== "string")) {
    throw new Error("Location options could not be loaded.");
  }
  return value as T[];
}

export default function HomeIdentityEditor({ homeId, viewerId, triggerLabel = "Edit property", className = "home-text-action" }: Props) {
  const [open, setOpen] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<Status>({ dirty: false, pending: false });
  const sessionRef = useRef<HTMLDivElement>(null);
  const onStatus = useCallback((next: Status) => setStatus(next), []);
  const close = () => {
    if (status.pending) return;
    if (status.dirty) { setDiscard(true); return; }
    setOpen(false);
  };
  return (
    <>
      <Dialog open={open} onOpenChange={(value) => {
        if (!value) { close(); return; }
        setSaved(false); setDiscard(false); setStatus({ dirty: false, pending: false }); setOpen(true);
      }}>
        <DialogTrigger asChild><button type="button" className={className}><Pencil size={15} aria-hidden="true" />{triggerLabel}</button></DialogTrigger>
        <DialogContent data-ts-core-ui="true" data-testid="home-identity-dialog" className="home-identity-dialog"
          onInteractOutside={(event) => { if (status.dirty || status.pending) { event.preventDefault(); close(); } }}
          onEscapeKeyDown={(event) => { if (status.dirty || status.pending) { event.preventDefault(); close(); } }}>
          <DialogHeader className="home-identity-header"><DialogTitle>Edit property details</DialogTitle><DialogDescription>
            Update this private property record. Ownership and sharing permissions do not change.
          </DialogDescription></DialogHeader>
          {discard && <div className="home-identity-discard" role="alert">
            <p>Discard your unsaved changes?</p><div><button type="button" onClick={() => {
              setDiscard(false);
              window.requestAnimationFrame(() => sessionRef.current?.querySelector<HTMLInputElement>("input")?.focus());
            }}>Keep editing</button>
              <button type="button" onClick={() => { setOpen(false); setDiscard(false); setStatus({ dirty: false, pending: false }); }}>Discard changes</button></div>
          </div>}
          <div ref={sessionRef} className="home-identity-session" hidden={discard}>
            {open && <HomeIdentitySession key={`${viewerId}:${homeId}`} homeId={homeId} viewerId={viewerId} onStatus={onStatus}
              onCancel={close} onSaved={() => { setSaved(true); setOpen(false); setStatus({ dirty: false, pending: false }); }} />}
          </div>
        </DialogContent>
      </Dialog>
      {saved && <span className="home-identity-saved" role="status">Property details saved.</span>}
    </>
  );
}

function HomeIdentitySession({ homeId, viewerId, ...formProps }: {
  homeId: string; viewerId: string; onStatus: (value: Status) => void; onCancel: () => void; onSaved: () => void;
}) {
  const query = useQuery({
    queryKey: [`/api/homes/${encodeURIComponent(homeId)}/identity`, viewerId],
    queryFn: async () => parseHomeIdentitySnapshot(await apiRequest("GET", `/api/homes/${encodeURIComponent(homeId)}/identity`), homeId),
    staleTime: 0, retry: false, refetchOnMount: "always", refetchOnWindowFocus: false,
  });
  if (query.isError) return <div className="home-identity-load" role="alert"><p>This property's details could not be opened. Your record has not changed.</p><button type="button" onClick={() => void query.refetch()}>Retry</button></div>;
  if (!query.data || !query.isFetchedAfterMount) return <p className="home-identity-load" role="status">Loading property details…</p>;
  // This form is deliberately not keyed by revision: a background read must never erase a draft.
  return <HomeIdentityForm homeId={homeId} viewerId={viewerId} initial={query.data} {...formProps} />;
}

export function HomeIdentityForm({ homeId, viewerId, initial, onStatus, onCancel, onSaved }: {
  homeId: string; viewerId: string; initial: HomeIdentitySnapshot;
  onStatus: (value: Status) => void; onCancel: () => void; onSaved: () => void;
}) {
  const prefix = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState<HomeIdentityDraft>(() => homeIdentityDraft(initial.identity));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<HomeIdentityField, string>>>({});
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const changes = homeIdentityChanges(baseline.identity, draft);
  const dirty = Object.keys(changes).length > 0;
  const states = useQuery({ queryKey: ["/api/states"], queryFn: async () => options<Options>(await apiRequest("GET", "/api/states"), "code"), staleTime: 60 * 60 * 1000 });
  const counties = useQuery({ queryKey: ["/api/counties", draft.stateCode], enabled: Boolean(draft.stateCode),
    queryFn: async () => options<County>(await apiRequest("GET", `/api/counties?state=${encodeURIComponent(draft.stateCode)}`), "fips"), staleTime: 60 * 60 * 1000 });

  const save = useMutation({
    mutationFn: async (body: HomeIdentityUpdate) => parseHomeIdentitySnapshot(await apiRequest("PATCH", `/api/homes/${encodeURIComponent(homeId)}/identity`, body), homeId),
    onSuccess: async (result) => {
      setBaseline(result); setDraft(homeIdentityDraft(result.identity)); setMessage(""); setConflict(false);
      queryClient.setQueryData([`/api/homes/${encodeURIComponent(homeId)}/identity`, viewerId], result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/homes"] }),
        queryClient.invalidateQueries({ queryKey: [`/api/homes/${encodeURIComponent(homeId)}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/homes/${encodeURIComponent(homeId)}/homeid-dashboard`] }),
      ]);
      onSaved();
    },
    onError: (error: unknown) => {
      const apiError = error as { status?: number; code?: string; details?: { fieldErrors?: Partial<Record<HomeIdentityField, string>> } };
      const fields = apiError.details?.fieldErrors || {};
      setFieldErrors(fields); setConflict(apiError.status === 409 || apiError.code === "PROPERTY_CHANGED");
      setMessage(apiError.status === 409 ? "This property changed in another session. Your draft is still here; review the latest details before saving." :
        apiError.status === 400 ? "Check the highlighted fields. Nothing was saved." :
        apiError.status === 401 || apiError.status === 403 || apiError.status === 404 ? "Your account can no longer edit this property. Nothing was saved." : "The save did not complete. Your changes are still here; retry when the connection is available.");
    },
  });
  const pending = save.isPending || reloading;
  useEffect(() => onStatus({ dirty, pending }), [dirty, pending, onStatus]);
  useEffect(() => { formRef.current?.querySelector<HTMLInputElement>("input")?.focus(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => { if (message) errorRef.current?.focus(); }, [message]);

  const change = (field: HomeIdentityField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value, ...(field === "stateCode" && value !== current.stateCode ? { countyFips: "" } : {}) }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    // A conflict remains actionable even when the user continues reviewing the draft.
    if (!conflict) setMessage("");
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (pending || !dirty || conflict) return;
    const parsed = homeIdentityUpdateSchema.safeParse({ revision: baseline.revision, changes });
    const errors: Partial<Record<HomeIdentityField, string>> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) {
      const field = issue.path[1] as HomeIdentityField;
      if (HOME_IDENTITY_FIELDS.includes(field)) errors[field] = issue.message;
    }
    if (HOME_LOCATION_FIELDS.some((field) => Object.hasOwn(changes, field)) && HOME_LOCATION_FIELDS.some((field) => draft[field].trim())) {
      if (!draft.stateCode) errors.stateCode = "Choose a state.";
      if (!draft.countyFips) errors.countyFips = "Choose a county or parish.";
    }
    if (!parsed.success || Object.keys(errors).length) {
      setFieldErrors(errors); setMessage("Check the highlighted fields. Nothing was saved."); return;
    }
    setMessage(""); setFieldErrors({}); save.mutate(parsed.data);
  };
  const loadLatest = async () => {
    if (pending) return;
    setReloading(true);
    try {
      const latest = parseHomeIdentitySnapshot(await apiRequest("GET", `/api/homes/${encodeURIComponent(homeId)}/identity`), homeId);
      setBaseline(latest); setDraft(homeIdentityDraft(latest.identity)); setFieldErrors({}); setMessage(""); setConflict(false);
      window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>("input")?.focus());
    } catch { setMessage("The latest property details could not be loaded. Your draft has not been discarded."); }
    finally { setReloading(false); }
  };
  const inputProps = (field: HomeIdentityField) => ({
    id: `${prefix}-${field}`, name: field, value: draft[field], disabled: pending,
    "aria-invalid": Boolean(fieldErrors[field]), "aria-describedby": fieldErrors[field] ? `${prefix}-${field}-error` : undefined,
  });
  const label = (field: HomeIdentityField) => <label htmlFor={`${prefix}-${field}`}>{HOME_IDENTITY_LABELS[field]}</label>;
  const error = (field: HomeIdentityField) => fieldErrors[field] && <p className="home-identity-field-error" id={`${prefix}-${field}-error`}>{fieldErrors[field]}</p>;
  const field = (name: HomeIdentityField, maxLength: number, autocomplete?: string) => <div className="home-identity-field" key={name}>{label(name)}<input {...inputProps(name)} maxLength={maxLength} autoComplete={autocomplete || "off"} onChange={(event) => change(name, event.target.value)} />{error(name)}</div>;

  return <form ref={formRef} className="home-identity-form" onSubmit={submit} noValidate aria-busy={pending}>
    <div className="home-identity-fields">
      {message && <div ref={errorRef} className="home-identity-error" role="alert" tabIndex={-1}><p>{message}</p>
        {conflict && <button type="button" disabled={pending} onClick={() => void loadLatest()}>Discard draft and load latest</button>}
      </div>}
      <fieldset disabled={pending}><legend>Property</legend><div className="home-identity-grid">
        {field("nickname", 160)}
        <div className="home-identity-field">{label("propertyType")}<select {...inputProps("propertyType")} onChange={(event) => change("propertyType", event.target.value)}>
          <option value="">Not recorded</option>
          {draft.propertyType && !HOME_IDENTITY_TYPES.some(([value]) => value === draft.propertyType) && <option value={draft.propertyType}>{draft.propertyType} (saved)</option>}
          {HOME_IDENTITY_TYPES.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
        </select>{error("propertyType")}</div>
        <div className="home-identity-field">{label("yearBuilt")}<input {...inputProps("yearBuilt")} inputMode="numeric" maxLength={4} autoComplete="off" onChange={(event) => change("yearBuilt", event.target.value)} />{error("yearBuilt")}<small>Leave blank for land or an unfinished build.</small></div>
      </div></fieldset>
      <fieldset disabled={pending}><legend>Location</legend><p className="home-identity-hint">Choose the property's location, which may differ from your account address.</p><div className="home-identity-grid">
        {field("address1", 180, "section-property address-line1")}{field("address2", 180, "section-property address-line2")}{field("city", 120, "section-property address-level2")}
        <div className="home-identity-field">{label("stateCode")}<select {...inputProps("stateCode")} disabled={pending || states.isPending || states.isError} onChange={(event) => change("stateCode", event.target.value)}>
          <option value="">Choose state</option>{draft.stateCode && !states.data?.some((state) => state.code === draft.stateCode) && <option value={draft.stateCode}>{draft.stateCode} (saved)</option>}
          {states.data?.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
        </select>{error("stateCode")}{states.isPending && <small role="status">Loading states…</small>}{states.isError && <button type="button" onClick={() => void states.refetch()}>Retry states</button>}</div>
        <div className="home-identity-field">{label("countyFips")}<select {...inputProps("countyFips")} disabled={pending || !draft.stateCode || counties.isPending || counties.isError} onChange={(event) => change("countyFips", event.target.value)}>
          <option value="">Choose county or parish</option>{draft.countyFips && !counties.data?.some((county) => county.fips === draft.countyFips) && <option value={draft.countyFips}>Saved county or parish</option>}
          {counties.data?.map((county) => <option key={county.fips} value={county.fips}>{county.name}</option>)}
        </select>{error("countyFips")}{draft.stateCode && counties.isPending && <small role="status">Loading counties…</small>}{counties.isError && <button type="button" onClick={() => void counties.refetch()}>Retry counties</button>}</div>
        {field("zipCode", 10, "section-property postal-code")}
      </div></fieldset>
      <p className="home-identity-hint">These are your recorded details, not a verified address or proof of ownership. Saving does not publish the property.</p>
    </div>
    <div className="home-identity-footer"><p role="status">{pending ? "Saving or loading property details…" : dirty ? "Unsaved changes" : "No changes to save"}</p><button type="button" disabled={pending} onClick={onCancel}>Cancel</button><button className="home-identity-save" type="submit" disabled={pending || !dirty || conflict}>{save.isPending ? "Saving…" : "Save property details"}</button></div>
  </form>;
}
