import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  Send,
  X,
} from "lucide-react";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import { isValidDirectConnectRequestPhone } from "@shared/directConnectPhone";
import { JW_STONE_PROFILE_SLUG, JW_STONE_PUBLIC_IDENTITY } from "@shared/jwStonePresentation";

export type RedGranitiContactEntry = "choice" | "request";

type CustomerRole =
  | "fabricator"
  | "builder"
  | "designer"
  | "architect"
  | "homeowner"
  | "other";

type MaterialFormat = "rough_block" | "slab" | "first_cut" | "not_sure";

type Props = {
  open: boolean;
  onClose: () => void;
  initialView: RedGranitiContactEntry;
  platformBaseHref?: string;
};

type PanelView = "choice" | "request" | "call_started" | "success";

const CUSTOMER_ROLES: Array<{ value: CustomerRole; label: string }> = [
  { value: "fabricator", label: "Fabricator" },
  { value: "builder", label: "Builder or developer" },
  { value: "designer", label: "Designer" },
  { value: "architect", label: "Architect" },
  { value: "homeowner", label: "Homeowner" },
  { value: "other", label: "Other" },
];

const MATERIAL_FORMATS: Array<{ value: MaterialFormat; label: string }> = [
  { value: "rough_block", label: "Rough block" },
  { value: "slab", label: "Slab" },
  { value: "first_cut", label: "First-cut requirement" },
  { value: "not_sure", label: "Not sure yet" },
];

function labelFor<T extends string>(
  rows: Array<{ value: T; label: string }>,
  value: T | ""
): string {
  return rows.find((row) => row.value === value)?.label || "";
}

function clean(value: string): string {
  return value.trim();
}

export default function RedGranitiDirectConnectPanel({
  open,
  onClose,
  initialView,
  platformBaseHref = "",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [view, setView] = useState<PanelView>(initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [callPhone, setCallPhone] = useState("");
  const [callTel, setCallTel] = useState("");
  const [requestId, setRequestId] = useState("");
  const [requestWorkspacePath, setRequestWorkspacePath] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    customerRole: "" as CustomerRole | "",
    material: "",
    format: "" as MaterialFormat | "",
    quantityDimensions: "",
    destination: "",
    timing: "",
    details: "",
    website: "",
  });

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setView(initialView);
    setBusy(false);
    setError("");
    setCallPhone("");
    setCallTel("");
    setRequestId("");
    setRequestWorkspacePath("");
    requestAnimationFrame(() => panelRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [initialView, onClose, open]);

  const requestHref = useMemo(() => {
    if (requestWorkspacePath) {
      return qualifyPublicProfileItemDestination(requestWorkspacePath, platformBaseHref);
    }
    const params = new URLSearchParams({
      source: "profile_express",
      from: "red_graniti_profile",
      profile: JW_STONE_PROFILE_SLUG,
      profileName: JW_STONE_PUBLIC_IDENTITY.brandName,
      offerHomeId: "1",
    });
    if (requestId) params.set("requestId", requestId);
    return qualifyPublicProfileItemDestination(
      `/direct-connect/engagements?${params.toString()}`,
      platformBaseHref
    );
  }, [platformBaseHref, requestId, requestWorkspacePath]);

  if (!open) return null;

  const close = () => {
    if (!busy) onClose();
  };

  const startCall = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/tradepartner-profiles/${JW_STONE_PROFILE_SLUG}/express-contact/reveal`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorityGate: "profile_direct_connect",
            decision: "call",
          }),
        }
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok || typeof json?.tel !== "string") {
        throw new Error("Calling is unavailable right now. Send a request instead.");
      }
      setCallPhone(String(json.phone || ""));
      setCallTel(json.tel);
      setView("call_started");
      window.location.href = json.tel;
    } catch (cause: any) {
      setError(cause?.message || "Calling is unavailable right now. Send a request instead.");
    } finally {
      setBusy(false);
    }
  };

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    const name = clean(form.name);
    const email = clean(form.email);
    const phone = clean(form.phone);
    const customerRole = labelFor(CUSTOMER_ROLES, form.customerRole);
    const materialFormat = labelFor(MATERIAL_FORMATS, form.format);

    if (name.length < 2 || !email || !email.includes("@")) {
      setError("Enter your name and a working email address.");
      setBusy(false);
      return;
    }
    if (!isValidDirectConnectRequestPhone(phone)) {
      setError("Enter a complete phone number so JW Stone can reach you.");
      setBusy(false);
      return;
    }
    if (!customerRole) {
      setError("Select the type of customer or project team you represent.");
      setBusy(false);
      return;
    }
    if (!materialFormat) {
      setError("Choose whether you need a block, slab, first cut, or help deciding.");
      setBusy(false);
      return;
    }
    if (!clean(form.destination)) {
      setError("Enter the delivery city, state, or country.");
      setBusy(false);
      return;
    }

    const message = [
      "R.E.D. Graniti first-cut request",
      `Customer type: ${customerRole}`,
      clean(form.company) ? `Company: ${clean(form.company)}` : "",
      clean(form.material) ? `Material: ${clean(form.material)}` : "Material: Help me choose",
      `Needed format: ${materialFormat}`,
      clean(form.quantityDimensions)
        ? `Quantity or dimensions: ${clean(form.quantityDimensions)}`
        : "Quantity or dimensions: To be confirmed",
      `Delivery destination: ${clean(form.destination)}`,
      clean(form.timing) ? `Timing: ${clean(form.timing)}` : "Timing: To be confirmed",
      clean(form.details) ? `Project details: ${clean(form.details)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await fetch(
        `/api/tradepartner-profiles/${JW_STONE_PROFILE_SLUG}/express-request`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            phone,
            requestType: "request_material",
            message,
            stoneName: clean(form.material) || undefined,
            serviceName: "R.E.D. Graniti first-cut distribution",
            updatesOptIn: false,
            website: form.website,
          }),
        }
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          response.status === 400
            ? "Check the contact details and project information, then try again."
            : "The request could not be sent yet. Try again or call JW Stone."
        );
      }
      setRequestId(String(json?.requestId || ""));
      setRequestWorkspacePath(
        typeof json?.requestWorkspacePath === "string" ? json.requestWorkspacePath : ""
      );
      setView("success");
    } catch (cause: any) {
      setError(cause?.message || "The request could not be sent yet. Try again or call JW Stone.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="red-graniti-contact-title"
        tabIndex={-1}
        className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[2rem] bg-[#f4f1ec] shadow-2xl outline-none sm:max-w-3xl sm:rounded-[2rem]"
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-black/10 bg-[rgba(244,241,236,0.96)] px-5 py-4 backdrop-blur-xl sm:px-7">
          {view === "request" ? (
            <button
              type="button"
              onClick={() => {
                setError("");
                setView("choice");
              }}
              disabled={busy}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black disabled:opacity-50"
              aria-label="Back to contact options"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d71920] text-white">
              {view === "success" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Phone className="h-5 w-5" />
              )}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d71920]">
              R.E.D. Graniti first-cut distribution
            </p>
            <h2 id="red-graniti-contact-title" className="truncate text-xl font-black text-[#171313]">
              {view === "request"
                ? "Send your project details"
                : view === "success"
                  ? "Request sent"
                  : view === "call_started"
                    ? "Calling JW Stone"
                    : "Contact JW Stone"}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 sm:p-7">
          {error ? (
            <div role="alert" className="mb-5 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">
              {error}
            </div>
          ) : null}

          {view === "choice" ? (
            <div>
              <p className="max-w-2xl text-base leading-7 text-black/65">
                JW Stone handles first-cut requests for R.E.D. Graniti stone. Call now or send the
                material, format, destination, and timing for review.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={startCall}
                  disabled={busy}
                  className="flex min-h-44 flex-col items-start justify-between rounded-[1.5rem] bg-[#d71920] p-6 text-left text-white shadow-lg shadow-red-950/15 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Phone className="h-7 w-7" />}
                  <span>
                    <strong className="block text-2xl font-black">Call JW Stone</strong>
                    <span className="mt-2 block text-sm leading-6 text-white/80">
                      Speak with the exclusive first-cut distributor.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setView("request");
                  }}
                  disabled={busy}
                  className="flex min-h-44 flex-col items-start justify-between rounded-[1.5rem] border border-black/12 bg-white p-6 text-left text-[#171313] shadow-[0_18px_45px_rgba(23,19,19,0.07)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  <Send className="h-7 w-7 text-[#d71920]" />
                  <span>
                    <strong className="block text-2xl font-black">Start a Request</strong>
                    <span className="mt-2 block text-sm leading-6 text-black/60">
                      Send stone, size, quantity, delivery, and schedule details.
                    </span>
                  </span>
                </button>
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm leading-6 text-black/60">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#d71920]" />
                <span>{JW_STONE_PUBLIC_IDENTITY.address.formatted}</span>
              </div>
            </div>
          ) : null}

          {view === "request" ? (
            <form onSubmit={submitRequest} className="space-y-6">
              <div>
                <p className="text-base leading-7 text-black/65">
                  Share what you know. JW Stone can help finish the source and first-cut plan.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-[#171313]">
                  Name
                  <input
                    required
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                    autoComplete="name"
                  />
                </label>
                <label className="text-sm font-bold text-[#171313]">
                  Company <span className="font-medium text-black/45">(optional)</span>
                  <input
                    value={form.company}
                    onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                    autoComplete="organization"
                  />
                </label>
                <label className="text-sm font-bold text-[#171313]">
                  Email
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                    autoComplete="email"
                  />
                </label>
                <label className="text-sm font-bold text-[#171313]">
                  Phone
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                    autoComplete="tel"
                  />
                </label>
                <label className="text-sm font-bold text-[#171313]">
                  I am a
                  <select
                    required
                    value={form.customerRole}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customerRole: event.target.value as CustomerRole,
                      }))
                    }
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                  >
                    <option value="">Select one</option>
                    {CUSTOMER_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-bold text-[#171313]">
                  Needed format
                  <select
                    required
                    value={form.format}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        format: event.target.value as MaterialFormat,
                      }))
                    }
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                  >
                    <option value="">Select one</option>
                    {MATERIAL_FORMATS.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-[#171313] sm:col-span-2">
                  R.E.D. material or stone need <span className="font-medium text-black/45">(optional)</span>
                  <input
                    value={form.material}
                    onChange={(event) => setForm((current) => ({ ...current, material: event.target.value }))}
                    placeholder="Material name, color, movement, or application"
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none placeholder:text-black/35 focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                  />
                </label>
                <label className="text-sm font-bold text-[#171313]">
                  Quantity or dimensions <span className="font-medium text-black/45">(optional)</span>
                  <input
                    value={form.quantityDimensions}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, quantityDimensions: event.target.value }))
                    }
                    placeholder="Example: 2 blocks or 135 × 78 in."
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none placeholder:text-black/35 focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                  />
                </label>
                <label className="text-sm font-bold text-[#171313]">
                  Delivery destination
                  <input
                    required
                    value={form.destination}
                    onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))}
                    placeholder="City, state, or country"
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none placeholder:text-black/35 focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                  />
                </label>
                <label className="text-sm font-bold text-[#171313] sm:col-span-2">
                  Needed timing <span className="font-medium text-black/45">(optional)</span>
                  <input
                    value={form.timing}
                    onChange={(event) => setForm((current) => ({ ...current, timing: event.target.value }))}
                    placeholder="Target order, fabrication, or delivery date"
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none placeholder:text-black/35 focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                  />
                </label>
                <label className="text-sm font-bold text-[#171313] sm:col-span-2">
                  Project details <span className="font-medium text-black/45">(optional)</span>
                  <textarea
                    value={form.details}
                    onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))}
                    placeholder="Application, finish, matching requirements, freight needs, or anything else JW Stone should review"
                    className="mt-2 min-h-32 w-full resize-y rounded-xl border border-black/15 bg-white px-4 py-3 font-medium outline-none placeholder:text-black/35 focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                  />
                </label>
              </div>

              <input
                tabIndex={-1}
                aria-hidden="true"
                autoComplete="off"
                value={form.website}
                onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
                className="absolute -left-[9999px] h-px w-px opacity-0"
              />

              <div className="flex flex-col-reverse gap-3 border-t border-black/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setView("choice")}
                  disabled={busy}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 bg-white px-6 text-sm font-black text-[#171313] disabled:opacity-50"
                >
                  Contact options
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#d71920] px-7 text-sm font-black text-white shadow-lg shadow-red-950/15 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send to JW Stone
                </button>
              </div>
            </form>
          ) : null}

          {view === "call_started" ? (
            <div className="py-8 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-[#d71920]">
                <Phone className="h-7 w-7" />
              </span>
              <h3 className="mt-5 text-3xl font-black text-[#171313]">Calling JW Stone</h3>
              <p className="mx-auto mt-3 max-w-md text-base leading-7 text-black/60">
                Your phone should open the call now.
              </p>
              {callTel ? (
                <a href={callTel} className="mt-5 inline-block text-xl font-black text-[#171313] underline underline-offset-4">
                  {callPhone || "Call again"}
                </a>
              ) : null}
              <div className="mt-8 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("request")}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 bg-white px-6 text-sm font-black text-[#171313]"
                >
                  Send a request instead
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#171313] px-6 text-sm font-black text-white"
                >
                  Back to profile
                </button>
              </div>
            </div>
          ) : null}

          {view === "success" ? (
            <div className="py-8 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <h3 className="mt-5 text-3xl font-black text-[#171313]">JW Stone has your request</h3>
              <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-black/60">
                The material, format, destination, and timing you supplied are attached to the
                R.E.D. Graniti first-cut request.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <a
                  href={requestHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 bg-white px-6 text-sm font-black text-[#171313]"
                >
                  Open request
                </a>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#171313] px-6 text-sm font-black text-white"
                >
                  Back to profile
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
