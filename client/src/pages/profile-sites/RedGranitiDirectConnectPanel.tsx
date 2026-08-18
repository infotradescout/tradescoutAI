import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Phone,
  Send,
  X,
} from "lucide-react";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import { revealJwStoneProtectedCall } from "@/pages/profile-sites/redGranitiProtectedContact";
import { isValidDirectConnectRequestPhone } from "@shared/directConnectPhone";
import { JW_STONE_PROFILE_SLUG, JW_STONE_PUBLIC_IDENTITY } from "@shared/jwStonePresentation";

export type RedGranitiContactEntry = "call" | "request";

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

type PanelView = "calling" | "request" | "call_started" | "success";

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
  const callAttemptedRef = useRef(false);
  const [view, setView] = useState<PanelView>(
    initialView === "call" ? "calling" : "request"
  );
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

  const performCall = useCallback(async () => {
    setBusy(true);
    setError("");
    setView("calling");
    try {
      const result = await revealJwStoneProtectedCall();
      setCallPhone(result.phone);
      setCallTel(result.tel);
      setView("call_started");
      window.location.href = result.tel;
    } catch (cause: any) {
      setError(cause?.message || "Calling is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!open) {
      callAttemptedRef.current = false;
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setView(initialView === "call" ? "calling" : "request");
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

  useEffect(() => {
    if (!open || initialView !== "call" || callAttemptedRef.current) return;
    callAttemptedRef.current = true;
    void performCall();
  }, [initialView, open, performCall]);

  if (!open) return null;

  const close = () => {
    if (!busy) onClose();
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
      setError("Enter a complete phone number so the first-cut team can reach you.");
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
            : "The request could not be sent yet. Try again or use Call."
        );
      }
      setRequestId(String(json?.requestId || ""));
      setRequestWorkspacePath(
        typeof json?.requestWorkspacePath === "string" ? json.requestWorkspacePath : ""
      );
      setView("success");
    } catch (cause: any) {
      setError(cause?.message || "The request could not be sent yet. Try again or use Call.");
    } finally {
      setBusy(false);
    }
  };

  const title =
    view === "request"
      ? "Start a first-cut request"
      : view === "success"
        ? "Request sent"
        : view === "call_started"
          ? "Call started"
          : "Connecting your call";

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
        className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[2rem] bg-[#f3f1ed] shadow-2xl outline-none sm:max-w-3xl sm:rounded-[2rem]"
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-black/10 bg-[rgba(243,241,237,0.97)] px-5 py-4 backdrop-blur-xl sm:px-7">
          {view === "request" && initialView === "call" ? (
            <button
              type="button"
              onClick={() => void performCall()}
              disabled={busy}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black disabled:opacity-50"
              aria-label="Back to call"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d71920] text-white">
              {view === "success" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : view === "request" ? (
                <Send className="h-5 w-5" />
              ) : busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Phone className="h-5 w-5" />
              )}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d71920]">
              R.E.D. Graniti
            </p>
            <h2 id="red-graniti-contact-title" className="truncate text-xl font-black text-[#1c1818]">
              {title}
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
          <p className="mb-5 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm leading-6 text-black/62">
            First-cut calls and requests are handled by JW Stone, R.E.D. Graniti's exclusive first-cut distributor.
          </p>

          {error ? (
            <div role="alert" className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">
              {error}
            </div>
          ) : null}

          {view === "calling" ? (
            <div className="py-10 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-[#d71920]">
                <Loader2 className="h-7 w-7 animate-spin" />
              </span>
              <h3 className="mt-5 text-2xl font-black text-[#1c1818]">Connecting your call</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-black/60">
                Your phone will open as soon as the protected number is ready.
              </p>
              {error ? (
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void performCall()}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-6 text-sm font-black text-[#1c1818]"
                  >
                    <Phone className="h-4 w-4" />
                    Try Call Again
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setView("request");
                    }}
                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#d71920] px-6 text-sm font-black text-white"
                  >
                    Start a Request
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {view === "request" ? (
            <form onSubmit={submitRequest} className="space-y-6">
              <p className="text-base leading-7 text-black/65">
                Share what you know. The first-cut team can help complete the material and delivery plan.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-[#1c1818]">
                  Name
                  <input
                    required
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                    autoComplete="name"
                  />
                </label>
                <label className="text-sm font-bold text-[#1c1818]">
                  Company <span className="font-medium text-black/45">(optional)</span>
                  <input
                    value={form.company}
                    onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                    autoComplete="organization"
                  />
                </label>
                <label className="text-sm font-bold text-[#1c1818]">
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
                <label className="text-sm font-bold text-[#1c1818]">
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
                <label className="text-sm font-bold text-[#1c1818]">
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
                <label className="text-sm font-bold text-[#1c1818]">
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
                <label className="text-sm font-bold text-[#1c1818] sm:col-span-2">
                  R.E.D. material or stone need <span className="font-medium text-black/45">(optional)</span>
                  <input
                    value={form.material}
                    onChange={(event) => setForm((current) => ({ ...current, material: event.target.value }))}
                    placeholder="Material name, color, movement, or application"
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none placeholder:text-black/35 focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                  />
                </label>
                <label className="text-sm font-bold text-[#1c1818]">
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
                <label className="text-sm font-bold text-[#1c1818]">
                  Delivery destination
                  <input
                    required
                    value={form.destination}
                    onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))}
                    placeholder="City, state, or country"
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none placeholder:text-black/35 focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                  />
                </label>
                <label className="text-sm font-bold text-[#1c1818] sm:col-span-2">
                  Needed timing <span className="font-medium text-black/45">(optional)</span>
                  <input
                    value={form.timing}
                    onChange={(event) => setForm((current) => ({ ...current, timing: event.target.value }))}
                    placeholder="Target order, fabrication, or delivery date"
                    className="mt-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 font-medium outline-none placeholder:text-black/35 focus:border-[#d71920] focus:ring-2 focus:ring-red-200"
                  />
                </label>
                <label className="text-sm font-bold text-[#1c1818] sm:col-span-2">
                  Project details <span className="font-medium text-black/45">(optional)</span>
                  <textarea
                    value={form.details}
                    onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))}
                    placeholder="Application, finish, matching requirements, freight needs, or other details"
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

              <div className="flex flex-col-reverse gap-3 border-t border-black/10 pt-5 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => void performCall()}
                  disabled={busy}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-6 text-sm font-black text-[#1c1818] disabled:opacity-50"
                >
                  <Phone className="h-4 w-4" />
                  Call
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#d71920] px-7 text-sm font-black text-white shadow-lg shadow-red-950/15 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send Request
                </button>
              </div>
            </form>
          ) : null}

          {view === "call_started" ? (
            <div className="py-8 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-[#d71920]">
                <Phone className="h-7 w-7" />
              </span>
              <h3 className="mt-5 text-3xl font-black text-[#1c1818]">Call started</h3>
              <p className="mx-auto mt-3 max-w-md text-base leading-7 text-black/60">
                Your phone should open the call now.
              </p>
              {callTel ? (
                <a href={callTel} className="mt-5 inline-block text-xl font-black text-[#1c1818] underline underline-offset-4">
                  {callPhone || "Call again"}
                </a>
              ) : null}
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setView("request");
                  }}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 bg-white px-6 text-sm font-black text-[#1c1818]"
                >
                  Start a Request
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#1c1818] px-6 text-sm font-black text-white"
                >
                  Back to Profile
                </button>
              </div>
            </div>
          ) : null}

          {view === "success" ? (
            <div className="py-8 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <h3 className="mt-5 text-3xl font-black text-[#1c1818]">Request sent</h3>
              <p className="mx-auto mt-3 max-w-md text-base leading-7 text-black/60">
                The first-cut team has your project details and can continue from the saved request.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <a
                  href={requestHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#d71920] px-6 text-sm font-black text-white"
                >
                  Open Request
                </a>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 bg-white px-6 text-sm font-black text-[#1c1818]"
                >
                  Back to Profile
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
