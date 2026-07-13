import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

type ExpressDirectConnectPanelProps = {
  open: boolean;
  onClose: () => void;
  profileSlug: string;
  businessName: string;
  hasViewerSession: boolean;
  initialStoneName?: string | null;
};

type PanelView = "choice" | "request" | "call_started" | "success";

const REQUEST_TYPES = [
  { value: "request_material", label: "Request material" },
  { value: "match_project", label: "Match stone to a project" },
  { value: "ask_about_bundle", label: "Ask about a bundle" },
  { value: "schedule_showroom", label: "Schedule a showroom visit" },
  { value: "other", label: "Something else" },
] as const;

export default function ExpressDirectConnectPanel({
  open,
  onClose,
  profileSlug,
  businessName,
  hasViewerSession,
  initialStoneName,
}: ExpressDirectConnectPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<PanelView>("choice");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [callPhone, setCallPhone] = useState("");
  const [callTel, setCallTel] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    requestType: initialStoneName ? "request_material" : "match_project",
    message: initialStoneName ? `I'm interested in ${initialStoneName}.` : "",
    website: "",
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onClose, open]);

  useEffect(() => {
    if (!open) return;
    setView("choice");
    setBusy(false);
    setError("");
    setCallPhone("");
    setCallTel("");
    setAccountCreated(false);
    setForm((current) => ({
      ...current,
      requestType: initialStoneName ? "request_material" : current.requestType,
      message: initialStoneName ? `I'm interested in ${initialStoneName}.` : "",
    }));
  }, [open, initialStoneName]);

  if (!open) return null;

  const membershipHref = `/pre-scout-setup?mode=create&next=${encodeURIComponent(
    `/u/${profileSlug}`
  )}`;

  const close = () => {
    if (!busy) onClose();
  };

  const startCall = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/tradepartner-profiles/${encodeURIComponent(profileSlug)}/express-contact/reveal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            authorityGate: "profile_direct_connect",
            decision: "call",
          }),
        }
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok || typeof json?.tel !== "string") {
        throw new Error(json?.message || "Calling is unavailable right now.");
      }
      setCallPhone(String(json.phone || ""));
      setCallTel(json.tel);
      setView("call_started");
      window.location.href = json.tel;
    } catch (cause: any) {
      setError(cause?.message || "Calling is unavailable right now.");
    } finally {
      setBusy(false);
    }
  };

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/tradepartner-profiles/${encodeURIComponent(profileSlug)}/express-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...form,
            stoneName: initialStoneName || undefined,
          }),
        }
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.message || "The request could not be sent.");
      }
      setAccountCreated(json?.accountCreated === true);
      setView("success");
    } catch (cause: any) {
      setError(cause?.message || "The request could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="express-direct-connect-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--brand-bg)] shadow-2xl outline-none sm:max-w-xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--brand-primary)]/10 bg-[var(--brand-bg)] px-5 py-4">
          <div className="flex items-center gap-3">
            {view === "request" ? (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setView("choice");
                }}
                className="rounded-full p-2 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10"
                aria-label="Back to contact options"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-secondary)]">
                Express Direct Connect
              </p>
              <h2
                id="express-direct-connect-title"
                className="text-xl font-bold text-[var(--brand-primary)]"
              >
                {businessName}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-full p-2 text-foreground/60 hover:bg-black/5"
            aria-label="Close Direct Connect"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-7">
          {view === "choice" ? (
            <div>
              <p className="mb-6 text-foreground/70">
                You already chose {businessName}. Call now or send a request directly to their
                managed inbox.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={startCall}
                  disabled={busy}
                  className="flex min-h-32 flex-col items-start justify-between rounded-2xl bg-[var(--brand-primary)] p-5 text-left text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Phone className="h-6 w-6" />
                  )}
                  <span>
                    <strong className="block text-lg">Call now</strong>
                    <span className="text-sm text-white/75">No account or verification</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setView("request");
                  }}
                  className="flex min-h-32 flex-col items-start justify-between rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-surface)] p-5 text-left text-[var(--brand-primary)] transition-transform hover:-translate-y-0.5"
                >
                  <MessageCircle className="h-6 w-6" />
                  <span>
                    <strong className="block text-lg">Send a request</strong>
                    <span className="text-sm text-foreground/60">Phone number required</span>
                  </span>
                </button>
              </div>
              <div className="mt-5 flex items-start gap-2 rounded-xl bg-[var(--brand-surface)] px-4 py-3 text-sm text-foreground/65">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--brand-secondary)]" />
                The phone field adds friction for automated spam. Your contact details stay inside
                the Direct Connect relationship.
              </div>
            </div>
          ) : null}

          {view === "request" ? (
            <form onSubmit={submitRequest} className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-[var(--brand-primary)]">
                  Send your request
                </h3>
                <p className="mt-1 text-sm text-foreground/65">
                  This goes only to {businessName}. It is not shared as a lead.
                </p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-foreground">Name</span>
                <input
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="w-full rounded-xl border border-[var(--brand-primary)]/20 bg-white px-4 py-3 text-foreground outline-none focus:border-[var(--brand-primary)]"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-foreground">Email</span>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className="w-full rounded-xl border border-[var(--brand-primary)]/20 bg-white px-4 py-3 text-foreground outline-none focus:border-[var(--brand-primary)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
                    Phone <span className="text-xs font-normal text-foreground/55">Required</span>
                  </span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(555) 555-5555"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    className="w-full rounded-xl border border-[var(--brand-primary)]/20 bg-white px-4 py-3 text-foreground outline-none focus:border-[var(--brand-primary)]"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-foreground">
                  What do you need?
                </span>
                <select
                  value={form.requestType}
                  onChange={(event) => setForm({ ...form, requestType: event.target.value })}
                  className="w-full rounded-xl border border-[var(--brand-primary)]/20 bg-white px-4 py-3 text-foreground outline-none focus:border-[var(--brand-primary)]"
                >
                  {REQUEST_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-foreground">Details</span>
                <textarea
                  required
                  rows={5}
                  minLength={10}
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  placeholder="Tell them what material, quantity, project, or timing you have in mind."
                  className="w-full resize-y rounded-xl border border-[var(--brand-primary)]/20 bg-white px-4 py-3 text-foreground outline-none focus:border-[var(--brand-primary)]"
                />
              </label>
              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
                className="absolute -left-[10000px] h-px w-px opacity-0"
              />
              <p className="text-xs leading-relaxed text-foreground/55">
                Your contact details create or connect your free TradeScout account so you can
                follow this request and Direct Connect with other businesses.
              </p>
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] px-7 py-3.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <MessageCircle className="h-5 w-5" />
                )}
                Send directly to {businessName}
              </button>
            </form>
          ) : null}

          {view === "call_started" ? (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                <Phone className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold text-[var(--brand-primary)]">
                Calling {businessName}
              </h3>
              {callTel ? (
                <a
                  href={callTel}
                  className="mt-3 inline-block text-lg font-bold text-[var(--brand-primary)] underline underline-offset-4"
                >
                  {callPhone || "Call again"}
                </a>
              ) : null}
              {!hasViewerSession ? (
                <div className="mt-7 rounded-2xl bg-[var(--brand-surface)] p-5 text-left">
                  <Search className="mb-3 h-6 w-6 text-[var(--brand-secondary)]" />
                  <p className="font-bold text-[var(--brand-primary)]">Keep this connection</p>
                  <p className="mt-1 text-sm text-foreground/65">
                    Join TradeScout free to save your activity and find more businesses you can
                    Direct Connect with.
                  </p>
                  <Link href={membershipHref}>
                    <button className="mt-4 w-full rounded-full bg-[var(--brand-primary)] px-6 py-3 font-semibold text-white">
                      Create free account
                    </button>
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          {view === "success" ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-5 h-14 w-14 text-emerald-600" />
              <h3 className="text-2xl font-bold text-[var(--brand-primary)]">Request sent</h3>
              <p className="mx-auto mt-2 max-w-md text-foreground/65">
                Your request went directly to {businessName}'s managed inbox.
              </p>
              {!hasViewerSession ? (
                <div className="mt-6 rounded-2xl bg-[var(--brand-surface)] p-5 text-left">
                  <p className="font-bold text-[var(--brand-primary)]">
                    {accountCreated
                      ? "Your TradeScout account is ready"
                      : "Follow it in TradeScout"}
                  </p>
                  <p className="mt-1 text-sm text-foreground/65">
                    {accountCreated
                      ? "Check your email to set up access. Then you can follow this request and find more businesses to Direct Connect with."
                      : "Sign in to follow this request and continue the conversation."}
                  </p>
                  <Link
                    href={`/pre-scout-setup?mode=signin&next=${encodeURIComponent("/direct-connect")}`}
                  >
                    <button className="mt-4 w-full rounded-full bg-[var(--brand-primary)] px-6 py-3 font-semibold text-white">
                      Open TradeScout
                    </button>
                  </Link>
                </div>
              ) : (
                <Link href="/direct-connect">
                  <button className="mt-6 rounded-full bg-[var(--brand-primary)] px-7 py-3 font-semibold text-white">
                    View in Direct Connect
                  </button>
                </Link>
              )}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
