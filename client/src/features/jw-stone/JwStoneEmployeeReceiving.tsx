import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, PackagePlus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { parseJwStoneReceipt, jwStoneReceivingCents, type JwStoneReceipt } from "@shared/jwStoneReceiving";

const BASE = "/api/u/jw-stone/receiving";
const field = "mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-stone-950 px-3 py-2 text-base text-white";
type Access = { viewerId: string; allowed: boolean; enabled: boolean };
export function JwStoneEmployeeReceiving() {
  const { user } = useAuth();
  const viewerId = String(user?.id || "");
  const access = useQuery<Access>({ queryKey: ["jw-stone", "receiving-access", viewerId], enabled: Boolean(viewerId), queryFn: () => apiRequest("GET", `${BASE}/access`), staleTime: 0, gcTime: 0, retry: false, refetchInterval: 30000 });
  const denied = access.error instanceof ApiError && (access.error.status === 401 || access.error.status === 403);
  if (!viewerId || denied || access.data?.viewerId !== viewerId || !access.data.allowed) return null;
  return <EmployeeWorkspace key={viewerId} viewerId={viewerId} enabled={access.data.enabled} />;
}
function EmployeeWorkspace({ viewerId, enabled }: { viewerId: string; enabled: boolean }) {
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const submission = useRef<{ receipt: JwStoneReceipt; files: File[] } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [locked, setLocked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const previews = useMemo(() => files.map(file => ({ name: file.name, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(photo => URL.revokeObjectURL(photo.url)), [previews]);
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || locked) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, locked]);
  const recent = useQuery<{ viewerId: string; items: { publicId: string; receipt: JwStoneReceipt; state: string; publicationStatus: string }[] }>({ queryKey: ["jw-stone", "receiving-history", viewerId], queryFn: () => apiRequest("GET", `${BASE}/receipts`), gcTime: 0, staleTime: 0, retry: false });
  function close() {
    // Closing preserves form and photo state; navigating away is warned separately.
    if (!busy.current) dialog.current?.close();
  }
  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = [...files, ...Array.from(incoming)];
    if (next.length > 8 || next.some(file => file.size > 10 * 1024 * 1024)) { setError("Use up to eight photos, each no larger than 10 MB."); return; }
    setFiles(next); setDirty(true); setError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !enabled) return;
    setError(""); setSuccess("");
    try {
      if (!submission.current) {
        const values = new FormData(event.currentTarget);
        const text = (key: string) => String(values.get(key) || "");
        const optionalNumber = (key: string) => text(key).trim() ? Number(text(key)) : null;
        if (!files.length) throw new Error("Take or select at least one photo of this lot.");
        const receipt = parseJwStoneReceipt({ receiptId: crypto.randomUUID(), materialName: text("materialName"), materialFamily: text("materialFamily"), materialClass: text("materialClass"), lotLabel: text("lotLabel"), quantity: Number(text("quantity")), length: Number(text("length")), height: Number(text("height")), dimensionUnit: text("dimensionUnit"), thicknessMm: Number(text("thicknessMm")), finish: text("finish"), locationLabel: text("locationLabel"), priceUnit: text("priceUnit"), sellPriceCents: jwStoneReceivingCents(text("sellPrice")), bundlePriceCents: jwStoneReceivingCents(text("bundlePrice")), bundleMinSlabs: optionalNumber("bundleMinSlabs"), landedCostCents: jwStoneReceivingCents(text("landedCost")), notes: text("notes") });
        submission.current = { receipt, files: [...files] };
      }
      const payload = new FormData();
      payload.append("receipt", JSON.stringify(submission.current.receipt));
      submission.current.files.forEach(file => payload.append("photos", file));
      busy.current = true; setSaving(true); setLocked(true);
      const result = await apiRequest(`${BASE}/receipts`, { method: "POST", body: payload, timeoutMs: 180000, headers: { "X-JW-Receiving": "1" } }) as { publicId: string; published: boolean };
      setSuccess(result.published ? "Arrival received and listed on JW Stone. Member pricing is attached to this exact lot." : "This arrival was already saved. It is not currently listed on the website.");
      submission.current = null; setLocked(false); setDirty(false); setFiles([]); form.current?.reset();
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["jw-stone", "new-arrivals"] }), queryClient.invalidateQueries({ queryKey: ["jw-stone", "arrival-prices"] }), queryClient.invalidateQueries({ queryKey: ["jw-stone", "receiving-history", viewerId] })]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The arrival could not be saved. Retry this same submission.");
      if (cause instanceof ApiError && cause.status === 400) { submission.current = null; setLocked(false); }
      if (cause instanceof ApiError && cause.status === 403) await queryClient.invalidateQueries({ queryKey: ["jw-stone", "receiving-access", viewerId] });
    } finally { busy.current = false; setSaving(false); }
  }
  return <>
    <div className="mx-auto max-w-[1600px] px-5 py-4"><button type="button" onClick={() => dialog.current?.showModal()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-stone-900 px-5 py-3 font-semibold text-white"><PackagePlus className="h-5 w-5" />JW Stone employee inventory</button></div>
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); close(); }} aria-labelledby="jw-receiving-title" className="m-auto max-h-[95dvh] w-[calc(100%_-_1rem)] max-w-5xl overflow-y-auto rounded-2xl border border-white/20 bg-stone-950 p-5 text-white shadow-2xl backdrop:bg-black/75 sm:p-8">
      <header className="mb-6 flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-amber-200">JW Stone · Employees</p><h2 id="jw-receiving-title" className="mt-2 text-2xl font-semibold">Receive stone</h2><p className="mt-2 text-sm text-white/70">Photograph the lot, enter its measurements and price, then list it without entering everything again.</p></div><button type="button" disabled={saving} onClick={close} aria-label="View JW Stone website" className="min-h-11 min-w-11"><X className="mx-auto h-5 w-5" /></button></header>
      {!enabled ? <p role="status" className="mb-5 rounded-lg border border-amber-300/40 p-4">Employee receiving is awaiting manager activation. Existing inventory remains available on the website.</p> : null}
      <form ref={form} onSubmit={submit} onChange={() => setDirty(true)}>
        <fieldset disabled={!enabled || saving || locked} className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">Arrival photos and details</legend>
          <div className="sm:col-span-2"><p className="mb-2 font-semibold">Photos of this lot</p><div className="flex flex-wrap gap-3"><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-white/25 px-4 py-3"><Camera className="h-5 w-5" />Take photo<input aria-label="Take a lot photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={event => { addFiles(event.target.files); event.target.value = ""; }} /></label><label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-white/25 px-4 py-3">Choose photos<input aria-label="Choose lot photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={event => { addFiles(event.target.files); event.target.value = ""; }} /></label></div><p className="mt-2 text-xs text-white/60">Up to eight photos. Photograph the actual slab face, lot label, and any relevant details.</p><ul className="mt-3 flex flex-wrap gap-3">{previews.map((photo, index) => <li key={photo.url} className="w-28"><img src={photo.url} alt={`Lot photo ${index + 1}`} className="h-24 w-28 rounded-lg object-cover" /><button type="button" onClick={() => setFiles(files.filter((_, i) => i !== index))} className="min-h-11 text-sm underline">Remove photo {index + 1}</button></li>)}</ul></div>
          <label>Material name<input name="materialName" required maxLength={160} className={field} /></label>
          <label>Material family<input name="materialFamily" required maxLength={80} list="jw-receiving-families" className={field} /><datalist id="jw-receiving-families">{["granite", "quartzite", "marble", "quartz", "onyx", "soapstone", "travertine"].map(value => <option key={value} value={value} />)}</datalist></label>
          <label>Material type<select name="materialClass" required defaultValue="" className={field}><option value="" disabled>Select type</option><option value="natural_stone">Natural stone</option><option value="engineered_stone">Engineered stone</option></select></label>
          <label>Lot or bundle label<input name="lotLabel" required maxLength={80} className={field} /></label>
          <label>Number of slabs<input name="quantity" type="number" inputMode="numeric" min={1} max={10000} step={1} required className={field} /></label>
          <label>Finish<input name="finish" required maxLength={80} placeholder="Polished, honed, leathered…" className={field} /></label>
          <label>Length<input name="length" type="number" inputMode="decimal" min="0.01" max={10000} step="any" required className={field} /></label>
          <label>Width / height<input name="height" type="number" inputMode="decimal" min="0.01" max={10000} step="any" required className={field} /></label>
          <label>Length and width unit<select name="dimensionUnit" defaultValue="in" className={field}><option value="in">Inches</option><option value="mm">Millimeters</option></select></label>
          <label>Thickness (millimeters)<input name="thicknessMm" type="number" inputMode="decimal" min="0.01" max={1000} step="any" required placeholder="20 for 2 cm; 30 for 3 cm" className={field} /></label>
          <p className="text-xs text-white/60 sm:col-span-2">Use one record only for slabs with the same size, finish, and price. Different sizes belong in separate records.</p>
          <label className="sm:col-span-2">Yard / rack location<input name="locationLabel" required maxLength={160} className={field} /></label>
          <label>Selling price ($)<input name="sellPrice" inputMode="decimal" required className={field} /></label>
          <label>Price applies per<select name="priceUnit" defaultValue="square_foot" className={field}><option value="square_foot">Square foot</option><option value="slab">Slab</option></select></label>
          <label>Bundle rate ($, optional)<input name="bundlePrice" inputMode="decimal" className={field} /><span className="text-xs text-white/60">Uses the same price unit selected above.</span></label>
          <label>Minimum slabs for bundle rate<input name="bundleMinSlabs" type="number" inputMode="numeric" min={1} max={10000} step={1} className={field} /></label>
          <label className="sm:col-span-2">Landed cost ($, employees only, optional)<input name="landedCost" inputMode="decimal" className={field} /><span className="text-xs text-white/60">Uses the selected price unit. Never shown to customers.</span></label>
          <label className="sm:col-span-2">Internal notes<textarea name="notes" maxLength={2000} className={field} /></label>
        </fieldset>
        {error ? <p role="alert" className="mt-4 rounded-lg border border-red-400/40 p-4 text-red-100">{error}</p> : null}
        {success ? <p role="status" className="mt-4 rounded-lg border border-emerald-400/40 p-4 text-emerald-100">{success}</p> : null}
        <p className="mt-5 text-sm text-white/65">Receive &amp; publish confirms that this stock has arrived and lists it in New Arrivals. Selling prices remain limited to JW Stone business members.</p>
        <button type="submit" disabled={!enabled || saving} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-amber-200 px-5 py-3 font-bold text-stone-950 disabled:opacity-50"><PackagePlus className="h-5 w-5" />{saving ? "Saving arrival…" : locked ? "Retry this same arrival" : "Receive & publish"}</button>
        {locked && !saving ? <p className="mt-2 text-xs text-white/65">The original submission is retained to prevent duplicate stock. Retry it without re-entering the lot.</p> : null}
      </form>
      <section className="mt-8 border-t border-white/15 pt-5"><h3 className="font-semibold">Recent receiving records</h3>{recent.isError ? <p className="mt-2 text-sm text-white/65">Recent records could not be loaded.</p> : recent.data?.viewerId === viewerId ? <ul className="mt-3 space-y-3">{recent.data.items.map(item => <li key={item.publicId} className="rounded-lg border border-white/15 p-3"><span className="font-semibold">{item.receipt.materialName}</span><p className="text-sm text-white/65">{item.receipt.lotLabel} · {item.receipt.quantity} slabs · {item.state === "pending" ? "Upload needs retry" : "Received"}</p></li>)}</ul> : <p className="mt-2 text-sm text-white/65">Loading records…</p>}</section>
    </dialog>
  </>;
}
