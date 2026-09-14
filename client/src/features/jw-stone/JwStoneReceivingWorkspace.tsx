import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, PackagePlus, X } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/queryClient";
import {
  parseJwStoneReceipt,
  jwStoneReceivingCents,
  type JwStoneReceipt,
} from "@shared/jwStoneReceiving";
import {
  readReceivingDraft,
  writeReceivingDraft,
  type ReceivingDraft,
} from "./jwStoneReceivingDraftStore";

const BASE = "/api/u/jw-stone/receiving";
const fieldClass =
  "mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-stone-950 px-3 py-2 text-base text-white";
const emptyDraft = (): ReceivingDraft => ({
  fields: { dimensionUnit: "in", priceUnit: "square_foot" },
  photos: [],
  frozenReceipt: null,
});
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Receiving could not finish. Your draft has been retained.";
const inputs = [
  ["materialName", "Material name", "text", true],
  ["materialFamily", "Material family", "text", true],
  ["lotLabel", "Lot or bundle label", "text", true],
  ["quantity", "Number of slabs", "number", true],
  ["length", "Length", "number", true],
  ["height", "Width / height", "number", true],
  ["thicknessMm", "Thickness (millimeters)", "number", true],
  ["finish", "Finish", "text", true],
  ["locationLabel", "Yard / rack location", "text", true],
  ["sellPrice", "Selling price ($)", "text", true],
  ["bundlePrice", "Bundle rate ($, optional)", "text", false],
  ["bundleMinSlabs", "Minimum slabs for bundle rate", "number", false],
  ["landedCost", "Landed cost ($, employees only, optional)", "text", false],
] as const;

export default function JwStoneReceivingWorkspace({
  viewerId,
  enabled,
}: {
  viewerId: string;
  enabled: boolean;
}) {
  const queries = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(false);
  const busy = useRef(false);
  const revision = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSequence = useRef(0);
  const current = useRef<ReceivingDraft>(emptyDraft());
  const acknowledged = useRef(false);
  const [draft, setDraft] = useState<ReceivingDraft>(current.current);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [storageStatus, setStorageStatus] = useState("Recovering saved draft…");
  const frozen = Boolean(draft.frozenReceipt);
  const previews = useMemo(
    () => draft.photos.map((file) => URL.createObjectURL(file)),
    [draft.photos]
  );
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  useEffect(() => {
    let mounted = true;
    alive.current = true;
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    void readReceivingDraft(viewerId)
      .then((snapshot) => {
        if (!mounted) return;
        if (snapshot.draft?.frozenReceipt) parseJwStoneReceipt(snapshot.draft.frozenReceipt);
        revision.current = snapshot.revision;
        current.current = snapshot.draft || emptyDraft();
        setDraft(current.current);
        setStorageStatus(
          snapshot.draft ? "Saved draft recovered on this device." : "Draft recovery is ready."
        );
        setReady(true);
      })
      .catch((cause) => {
        if (mounted) {
          setError(message(cause));
          setStorageStatus(
            "Draft recovery is unavailable. Reload after resolving browser storage access."
          );
        }
      });
    return () => {
      mounted = false;
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [viewerId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        current.current.photos.length ||
        current.current.fields.materialName ||
        current.current.frozenReceipt
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const history = useQuery<{
    viewerId: string;
    items: { publicId: string; receipt: JwStoneReceipt; state: string }[];
  }>({
    queryKey: ["jw-stone", "receiving-history", viewerId],
    queryFn: () => apiRequest("GET", `${BASE}/receipts`),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  function persist(value: ReceivingDraft | null): Promise<void> {
    const sequence = ++saveSequence.current;
    if (alive.current) setStorageStatus("Saving draft on this device…");
    const operation = queue.current
      .catch(() => undefined)
      .then(async () => {
        revision.current = await writeReceivingDraft(viewerId, revision.current, value);
      });
    queue.current = operation;
    return operation.then(
      () => {
        if (alive.current && sequence === saveSequence.current)
          setStorageStatus(value ? "Draft saved on this device." : "Saved draft cleared.");
      },
      (cause) => {
        if (alive.current && sequence === saveSequence.current) setStorageStatus(message(cause));
        throw cause;
      }
    );
  }
  function edit(next: ReceivingDraft) {
    if (!ready || busy.current || current.current.frozenReceipt) return;
    current.current = next;
    setDraft(next);
    setNotice("");
    if (timer.current) clearTimeout(timer.current);
    setStorageStatus("Saving draft on this device…");
    timer.current = setTimeout(() => {
      timer.current = null;
      void persist(next).catch((cause) => {
        if (alive.current) setError(message(cause));
      });
    }, 250);
  }
  function addPhotos(files: FileList | null) {
    const photos = [...current.current.photos, ...Array.from(files || [])];
    if (photos.length > 8 || photos.some((file) => file.size > 10 * 1024 * 1024)) {
      setError("Use up to eight photos, each no larger than 10 MB.");
      return;
    }
    edit({ ...current.current, photos });
  }
  async function discard() {
    if (busy.current || !ready || current.current.frozenReceipt) return;
    if (!window.confirm("Discard this unsubmitted draft and its photos from this device?")) return;
    busy.current = true;
    setSaving(true);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    try {
      await persist(null);
      if (alive.current) {
        current.current = emptyDraft();
        setDraft(current.current);
        setError("");
      }
    } catch (cause) {
      if (alive.current) setError(message(cause));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !enabled || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    try {
      let submission = current.current;
      if (!submission.frozenReceipt) {
        const f = current.current.fields;
        const text = (key: string) => f[key] || "";
        if (!current.current.photos.length)
          throw new Error("Take or select at least one photo of this lot.");
        const receipt = parseJwStoneReceipt({
          receiptId: crypto.randomUUID(),
          materialName: text("materialName"),
          materialFamily: text("materialFamily"),
          materialClass: text("materialClass"),
          lotLabel: text("lotLabel"),
          quantity: Number(text("quantity")),
          length: Number(text("length")),
          height: Number(text("height")),
          dimensionUnit: text("dimensionUnit"),
          thicknessMm: Number(text("thicknessMm")),
          finish: text("finish"),
          locationLabel: text("locationLabel"),
          priceUnit: text("priceUnit"),
          sellPriceCents: jwStoneReceivingCents(text("sellPrice")),
          bundlePriceCents: jwStoneReceivingCents(text("bundlePrice")),
          bundleMinSlabs: text("bundleMinSlabs").trim() ? Number(text("bundleMinSlabs")) : null,
          landedCostCents: jwStoneReceivingCents(text("landedCost")),
          notes: text("notes"),
        });
        submission = { ...current.current, frozenReceipt: receipt };
      }
      // Commit the exact UUID, fields and photo bytes before making any network mutation.
      // Until that succeeds the unsubmitted draft remains editable, including
      // photo removal when browser storage is full. Prior submissions stay frozen.
      await persist(submission);
      if (!alive.current) return;
      current.current = submission;
      setDraft(submission);
      if (!acknowledged.current) {
        const payload = new FormData();
        payload.append("receipt", JSON.stringify(current.current.frozenReceipt));
        current.current.photos.forEach((file) => payload.append("photos", file));
        const result = (await apiRequest(`${BASE}/receipts`, {
          method: "POST",
          body: payload,
          timeoutMs: 180000,
          headers: { "X-JW-Receiving": "1" },
        })) as { published: boolean };
        acknowledged.current = true;
        if (alive.current)
          setNotice(
            result.published
              ? "Arrival received and listed on JW Stone."
              : "Arrival already received; it is not currently listed on the website."
          );
      }
      await persist(null);
      if (!alive.current) return;
      current.current = emptyDraft();
      setDraft(current.current);
      acknowledged.current = false;
      // Refresh failures must not turn an acknowledged receipt into an upload failure.
      void Promise.all([
        queries.invalidateQueries({ queryKey: ["jw-stone", "new-arrivals"] }),
        queries.invalidateQueries({ queryKey: ["jw-stone", "arrival-prices"] }),
        queries.invalidateQueries({ queryKey: ["jw-stone", "receiving-history", viewerId] }),
      ]).catch(() => undefined);
    } catch (cause) {
      if (!alive.current) return;
      setError(message(cause));
      if (cause instanceof ApiError && cause.status === 400) {
        const editable = { ...current.current, frozenReceipt: null };
        try {
          await persist(editable);
          if (alive.current) {
            current.current = editable;
            setDraft(editable);
          }
        } catch (storageError) {
          if (alive.current) setError(message(storageError));
        }
      }
      if (cause instanceof ApiError && cause.status === 403)
        void queries.invalidateQueries({ queryKey: ["jw-stone", "receiving-access", viewerId] });
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  }
  const value = (name: string) => draft.fields[name] || "";
  const change = (name: string, value: string) =>
    edit({ ...current.current, fields: { ...current.current.fields, [name]: value } });
  const close = () => {
    if (!busy.current) dialog.current?.close();
  };
  return (
    <>
      <div className="mx-auto max-w-[1600px] px-5 py-4">
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="min-h-11 rounded-lg bg-stone-900 px-5 py-3 font-semibold text-white"
        >
          JW Stone employee inventory
        </button>
      </div>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        aria-labelledby="jw-receiving-title"
        className="m-auto max-h-[95dvh] w-[calc(100%_-_1rem)] max-w-5xl overflow-y-auto rounded-2xl border border-white/20 bg-stone-950 p-5 text-white backdrop:bg-black/75 sm:p-8"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-200">JW Stone · Employees</p>
            <h2 id="jw-receiving-title" className="mt-2 text-2xl font-semibold">
              Receive stone
            </h2>
            <p className="mt-2 text-sm text-white/70">
              Photograph the lot and enter its measurements, quantity, and pricing together.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={saving}
            aria-label="View JW Stone website"
            className="min-h-11 min-w-11"
          >
            <X className="mx-auto h-5 w-5" />
          </button>
        </header>
        <p role="status" className="mb-4 text-sm text-white/70">
          {storageStatus}
        </p>
        <p className="mb-4 text-xs text-white/60">
          Drafts include photos and internal notes and stay in this browser for your account. They
          do not sync between devices. Publishing requires a connection.
        </p>
        {!enabled ? (
          <p className="mb-5 rounded-lg border border-amber-300/40 p-4">
            Receiving is awaiting manager activation.
          </p>
        ) : null}
        <form onSubmit={submit}>
          <fieldset
            disabled={!enabled || !ready || saving || frozen}
            className="grid gap-4 sm:grid-cols-2"
          >
            <legend className="sr-only">Arrival details</legend>
            <div className="sm:col-span-2">
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/25 px-4 py-3">
                  <Camera className="h-5 w-5" />
                  Take photo
                  <input
                    type="file"
                    aria-label="Take a lot photo"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="sr-only"
                    onChange={(event) => {
                      addPhotos(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
                <label className="inline-flex min-h-11 items-center rounded-lg border border-white/25 px-4 py-3">
                  Choose photos
                  <input
                    type="file"
                    aria-label="Choose lot photos"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      addPhotos(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-white/60">
                Up to eight photos, 10 MB each. Photograph the actual stone and lot label.
              </p>
              <ul className="mt-3 flex flex-wrap gap-3">
                {previews.map((url, index) => (
                  <li key={url} className="w-28">
                    <img
                      src={url}
                      alt={`Lot photo ${index + 1}`}
                      className="h-24 w-28 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      className="min-h-11 text-sm underline"
                      onClick={() =>
                        edit({
                          ...current.current,
                          photos: current.current.photos.filter((_, i) => i !== index),
                        })
                      }
                    >
                      Remove photo {index + 1}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {inputs.map(([name, label, type, required]) => (
              <label key={name}>
                {label}
                <input
                  name={name}
                  value={value(name)}
                  onChange={(event) => change(name, event.target.value)}
                  type={type}
                  required={required}
                  min={
                    type === "number"
                      ? name === "quantity" || name === "bundleMinSlabs"
                        ? 1
                        : 0.01
                      : undefined
                  }
                  step={name === "quantity" || name === "bundleMinSlabs" ? 1 : "any"}
                  inputMode={type === "number" || /Price|Cost/.test(name) ? "decimal" : undefined}
                  maxLength={2000}
                  className={fieldClass}
                />
              </label>
            ))}
            <label>
              Material type
              <select
                name="materialClass"
                value={value("materialClass")}
                onChange={(event) => change("materialClass", event.target.value)}
                required
                className={fieldClass}
              >
                <option value="" disabled>
                  Select type
                </option>
                <option value="natural_stone">Natural stone</option>
                <option value="engineered_stone">Engineered stone</option>
              </select>
            </label>
            <label>
              Length and width unit
              <select
                name="dimensionUnit"
                value={value("dimensionUnit")}
                onChange={(event) => change("dimensionUnit", event.target.value)}
                className={fieldClass}
              >
                <option value="in">Inches</option>
                <option value="mm">Millimeters</option>
              </select>
            </label>
            <label>
              All rates apply per
              <select
                name="priceUnit"
                value={value("priceUnit")}
                onChange={(event) => change("priceUnit", event.target.value)}
                className={fieldClass}
              >
                <option value="square_foot">Square foot</option>
                <option value="slab">Slab</option>
              </select>
            </label>
            <label className="sm:col-span-2">
              Internal notes
              <textarea
                name="notes"
                value={value("notes")}
                onChange={(event) => change("notes", event.target.value)}
                maxLength={2000}
                className={fieldClass}
              />
            </label>
          </fieldset>
          <p className="mt-4 text-xs text-white/60">
            Thickness is always millimeters: 20 for 2 cm, 30 for 3 cm. Use separate records for
            different sizes, finishes, or prices.
          </p>
          {error ? (
            <p role="alert" className="mt-4 rounded-lg border border-red-400/40 p-4 text-red-100">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p
              role="status"
              className="mt-4 rounded-lg border border-emerald-400/40 p-4 text-emerald-100"
            >
              {notice}
            </p>
          ) : null}
          <p className="mt-4 text-sm text-white/65">
            Receive &amp; publish confirms the stock has arrived and lists it in New Arrivals.
            Selling prices remain limited to authorized JW Stone members; landed cost and notes stay
            internal.
          </p>
          <button
            type="submit"
            disabled={!enabled || !ready || saving}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-amber-200 px-5 py-3 font-bold text-stone-950 disabled:opacity-50"
          >
            <PackagePlus className="h-5 w-5" />
            {saving ? "Saving arrival…" : frozen ? "Retry this same arrival" : "Receive & publish"}
          </button>
          {frozen ? (
            <p className="mt-2 text-xs text-white/65">
              The original submission and photos are retained. Retry this same arrival to avoid
              duplicate inventory.
            </p>
          ) : (
            <button
              type="button"
              disabled={!ready || saving}
              onClick={() => void discard()}
              className="mt-3 min-h-11 text-sm underline"
            >
              Discard unsubmitted draft
            </button>
          )}
        </form>
        <section className="mt-8 border-t border-white/15 pt-5">
          <h3 className="font-semibold">Recent receiving records</h3>
          {history.isError ? (
            <p className="mt-2 text-sm">Recent records could not be loaded.</p>
          ) : history.data?.viewerId === viewerId ? (
            <ul className="mt-3 space-y-3">
              {history.data.items.map((item) => (
                <li key={item.publicId} className="rounded-lg border border-white/15 p-3">
                  <span className="font-semibold">{item.receipt.materialName}</span>
                  <p className="text-sm text-white/65">
                    {item.receipt.lotLabel} · {item.receipt.quantity} slabs received ·{" "}
                    {item.state === "pending" ? "Upload needs retry" : "Received"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm">Loading records…</p>
          )}
        </section>
      </dialog>
    </>
  );
}
