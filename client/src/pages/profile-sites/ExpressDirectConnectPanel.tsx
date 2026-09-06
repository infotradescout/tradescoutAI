import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  qualifyPublicProfileItemDestination,
  requiresDocumentNavigation,
} from "@/lib/publicProfileItemDestination";
import { getStoredDiscoveryLandingAttribution } from "@/lib/discoveryLanding";
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle, Phone, MapPin, X } from "lucide-react";
import type { DirectConnectMaterialTarget } from "./directConnectMaterial";
import { isValidDirectConnectRequestPhone } from "@shared/directConnectPhone";
import { sanitizeJwStoneDirectConnectSelections } from "@shared/jwStoneDirectConnect";

export type ExpressDirectConnectRequestType =
  | "request_material"
  | "match_project"
  | "ask_about_bundle"
  | "schedule_showroom"
  | "request_service"
  | "request_quote"
  | "ask_question"
  | "schedule_service"
  | "other";

export type ExpressDirectConnectMode = "materials" | "auto_glass" | "service";
export type ExpressDirectConnectCustomerRole =
  | "homeowner"
  | "fabricator"
  | "builder"
  | "designer"
  | "architect"
  | "other";
type ExpressDirectConnectDeliveryCustody = "business" | "tradescout_pending_owner";

const MATERIALS_CUSTOMER_ROLES: Array<{
  value: ExpressDirectConnectCustomerRole;
  label: string;
}> = [
  { value: "homeowner", label: "Homeowner" },
  { value: "fabricator", label: "Fabricator" },
  { value: "builder", label: "Builder" },
  { value: "designer", label: "Designer" },
  { value: "architect", label: "Architect" },
  { value: "other", label: "Other" },
];

type ExpressDirectConnectPanelProps = {
  open: boolean;
  onClose: () => void;
  profileSlug: string;
  platformBaseHref?: string;
  businessName: string;
  businessAddress?: string | null;
  hasViewerSession: boolean;
  allowCall: boolean;
  /** Profile sites: success/call follow-ups stay on the profile; only the site footer may exit to TradeScout. */
  stayInProfile?: boolean;
  requestMode?: ExpressDirectConnectMode;
  initialStoneName?: string | null;
  /** Selected service from a profile offering. Preserved through Direct Connect. */
  initialServiceName?: string | null;
  /** Optional caller-provided project questions; the visitor edits these before sending. */
  initialMessage?: string | null;
  /** Stable material slug (e.g. multi-green-onyx). Prefer over display name in URLs/source context. */
  initialItemId?: string | null;
  /** Optional bounded named-stone context. Existing scalar callers remain unchanged. */
  initialStoneSelections?: readonly DirectConnectMaterialTarget[] | null;
  /** Deliberate callers may open the request form directly; opening still performs no mutation. */
  initialView?: "choice" | "request";
  initialRequestType?: ExpressDirectConnectRequestType | null;
  contactOperatorName?: string | null;
  contactOperatorRole?: string | null;
  deliveryCustody?: ExpressDirectConnectDeliveryCustody;
};

type PanelView = "choice" | "request" | "call_started" | "success";

const REQUEST_MODE_CONFIG: Record<
  ExpressDirectConnectMode,
  {
    heading: string;
    placeholder: string;
    defaultType: ExpressDirectConnectRequestType;
    requestTypes: Array<{ value: ExpressDirectConnectRequestType; label: string }>;
  }
> = {
  materials: {
    heading: "What are you looking for?",
    placeholder: "Tell them the material, quantity, project, timing, or stone you have in mind.",
    defaultType: "match_project",
    requestTypes: [
      { value: "request_material", label: "Request material" },
      { value: "match_project", label: "Match stone to a project" },
      { value: "ask_about_bundle", label: "Ask about a bundle" },
      { value: "schedule_showroom", label: "Schedule a showroom visit" },
      { value: "other", label: "Something else" },
    ],
  },
  auto_glass: {
    heading: "What does the vehicle need?",
    placeholder:
      "Include the vehicle year, make, model, damaged glass, location, and preferred timing.",
    defaultType: "request_service",
    requestTypes: [
      { value: "request_service", label: "Windshield or auto glass service" },
      { value: "request_quote", label: "Request a quote" },
      { value: "ask_question", label: "Ask a question" },
      { value: "schedule_service", label: "Schedule mobile service" },
      { value: "other", label: "Something else" },
    ],
  },
  service: {
    heading: "What do you need?",
    placeholder: "Describe the job, location, timing, and the outcome you need.",
    defaultType: "request_service",
    requestTypes: [
      { value: "request_service", label: "Request service" },
      { value: "request_quote", label: "Request a quote" },
      { value: "ask_question", label: "Ask a question" },
      { value: "schedule_service", label: "Schedule service" },
      { value: "other", label: "Something else" },
    ],
  },
};

export default function ExpressDirectConnectPanel({
  open,
  onClose,
  profileSlug,
  platformBaseHref = "",
  businessName,
  businessAddress,
  hasViewerSession,
  allowCall,
  stayInProfile = false,
  requestMode = "service",
  initialStoneName,
  initialServiceName,
  initialMessage,
  initialItemId,
  initialStoneSelections,
  initialView = "choice",
  initialRequestType,
  contactOperatorName,
  contactOperatorRole,
  deliveryCustody = "business",
}: ExpressDirectConnectPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const config = REQUEST_MODE_CONFIG[requestMode];
  const safeStoneSelections = useMemo(
    () =>
      sanitizeJwStoneDirectConnectSelections({
        profileSlug,
        selections: (initialStoneSelections || []).map((selection) => ({
          itemId: selection.itemId,
          stoneName: selection.itemName,
        })),
      }),
    [initialStoneSelections, profileSlug]
  );
  const multiStoneSelections = safeStoneSelections.length > 1 ? safeStoneSelections : [];
  const singleSelection = safeStoneSelections.length === 1 ? safeStoneSelections[0] : null;
  const stableItemId = String(initialItemId || singleSelection?.itemId || "").trim() || null;
  const displayStoneName =
    String(initialStoneName || singleSelection?.stoneName || "").trim() || null;
  const selectedServiceName = String(initialServiceName || "").trim() || null;
  // `item` is human-facing Direct Connect context. Keep an anonymous
  // selection's stable slug only in `itemId` so it never becomes public copy.
  const itemParam = displayStoneName;
  const defaultRequestType =
    initialRequestType ||
    (stableItemId || itemParam || multiStoneSelections.length
      ? "request_material"
      : config.defaultType);
  const operatorName = String(contactOperatorName || "").trim() || businessName;
  const operatorRole = String(contactOperatorRole || "").trim();
  const hasSeparateOperator = operatorName.toLowerCase() !== businessName.toLowerCase();
  const [view, setView] = useState<PanelView>(initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [callPhone, setCallPhone] = useState("");
  const [callTel, setCallTel] = useState("");
  const [requestId, setRequestId] = useState("");
  const [requestWorkspacePath, setRequestWorkspacePath] = useState("");
  const [requestDeliveryCustody, setRequestDeliveryCustody] =
    useState<ExpressDirectConnectDeliveryCustody>(deliveryCustody);
  const initialFormMessage =
    initialMessage ||
    (selectedServiceName
      ? `I'm interested in ${selectedServiceName}.`
      : displayStoneName
        ? `I'm interested in ${displayStoneName}.`
        : multiStoneSelections.length
          ? `I'm interested in these ${multiStoneSelections.length} saved stone selections.`
          : stableItemId
            ? "I'm interested in this stone selection."
            : "");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    customerRole: "" as ExpressDirectConnectCustomerRole | "",
    requestType: defaultRequestType,
    message: initialFormMessage,
    // Compliance default: unchecked. Opt-in only when the visitor checks it.
    updatesOptIn: false,
    website: "",
  });
  const updatesOptInLabel =
    requestMode === "materials" && profileSlug === "jw-stone"
      ? "Email me about new arrivals, First Cut releases, and other JW Stone updates"
      : requestMode === "materials"
        ? "Email me about new arrivals, first cuts, and other promotions"
        : "Email me about updates and promotions";

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
    setView(initialView);
    setBusy(false);
    setError("");
    setCallPhone("");
    setCallTel("");
    setRequestId("");
    setRequestWorkspacePath("");
    setRequestDeliveryCustody(deliveryCustody);
    setForm((current) => ({
      ...current,
      customerRole: "",
      updatesOptIn: false,
      requestType: defaultRequestType,
      message: initialFormMessage,
    }));
  }, [
    defaultRequestType,
    deliveryCustody,
    displayStoneName,
    initialRequestType,
    initialFormMessage,
    initialView,
    multiStoneSelections.length,
    open,
    selectedServiceName,
    stableItemId,
  ]);

  const requestPath = useMemo(() => {
    if (requestWorkspacePath) return requestWorkspacePath;
    const params = new URLSearchParams();
    if (requestId) params.set("requestId", requestId);
    params.set("offerHomeId", "1");
    params.set("source", "profile_express");
    params.set("from", "public_profile");
    params.set("profile", profileSlug);
    params.set("profileName", businessName);
    if (itemParam) params.set("item", itemParam);
    if (stableItemId) params.set("itemId", stableItemId);
    if (selectedServiceName) params.set("service", selectedServiceName);
    return `/direct-connect/engagements?${params.toString()}`;
  }, [
    businessName,
    itemParam,
    profileSlug,
    requestId,
    requestWorkspacePath,
    selectedServiceName,
    stableItemId,
  ]);
  const requestHref = qualifyPublicProfileItemDestination(requestPath, platformBaseHref);

  if (!open) return null;

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
        throw new Error(
          response.status === 404
            ? "Calling is on the way. You can still send a request."
            : "Calling is unavailable right now. You can still send a request."
        );
      }
      setCallPhone(String(json.phone || ""));
      setCallTel(json.tel);
      setView("call_started");
      window.location.href = json.tel;
    } catch (cause: any) {
      setError(cause?.message || "Calling is unavailable right now. You can still send a request.");
    } finally {
      setBusy(false);
    }
  };

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const phone = form.phone.trim();
      if (!phone) {
        setError("Enter a phone number so they can reach you.");
        setBusy(false);
        return;
      }
      if (!isValidDirectConnectRequestPhone(phone)) {
        setError("Enter a complete phone number so they can reach you.");
        setBusy(false);
        return;
      }
      if (requestMode === "materials" && !form.customerRole) {
        setError(
          "Select whether you are a homeowner, fabricator, builder, designer, or architect."
        );
        setBusy(false);
        return;
      }
      const materialContext = multiStoneSelections.length
        ? {
            stoneName: undefined,
            itemId: undefined,
            stoneSelections: multiStoneSelections,
          }
        : {
            stoneName: displayStoneName || undefined,
            itemId: stableItemId || undefined,
            stoneSelections: undefined,
          };
      const roleLabel =
        MATERIALS_CUSTOMER_ROLES.find((role) => role.value === form.customerRole)?.label || "";
      const messageWithRole =
        requestMode === "materials" && roleLabel
          ? `Customer type: ${roleLabel}.\n\n${form.message}`
          : form.message;
      const discoveryAttribution = getStoredDiscoveryLandingAttribution(profileSlug);
      const response = await fetch(
        `/api/tradepartner-profiles/${encodeURIComponent(profileSlug)}/express-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone,
            requestType: form.requestType,
            message: messageWithRole,
            website: form.website,
            updatesOptIn: form.updatesOptIn === true,
            discoveryAttributionToken: discoveryAttribution?.discoveryAttributionToken,
            ...materialContext,
            serviceName: selectedServiceName || undefined,
          }),
        }
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          response.status === 400
            ? "Add your name, email, phone number, and a few details about what you need."
            : "We couldn’t send that yet."
        );
      }
      setRequestId(String(json?.requestId || ""));
      setRequestWorkspacePath(
        typeof json?.requestWorkspacePath === "string" ? json.requestWorkspacePath : ""
      );
      setRequestDeliveryCustody(
        json?.deliveryCustody === "tradescout_pending_owner"
          ? "tradescout_pending_owner"
          : "business"
      );
      setView("success");
    } catch (cause: any) {
      setError(cause?.message || "We couldn’t send that yet.");
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
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-stone-50 text-neutral-900 shadow-2xl outline-none sm:max-w-xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-stone-50 px-5 py-4">
          <div className="flex items-center gap-3">
            {view === "request" ? (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setView("choice");
                }}
                className="rounded-full p-2 text-neutral-900 hover:bg-black/5"
                aria-label="Back to contact options"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-ts-orange-dark">
                Direct Connect
              </p>
              <h2 id="express-direct-connect-title" className="text-xl font-bold text-neutral-900">
                {businessName}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-full p-2 text-neutral-900/60 hover:bg-black/5"
            aria-label="Close Direct Connect"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-7">
          {view === "choice" ? (
            <div>
              <p className="mb-6 text-stone-700">
                {hasSeparateOperator
                  ? `Call ${operatorName}${operatorRole ? `, the ${operatorRole} for ${businessName},` : ""} or send the product details.`
                  : `Call now or send ${businessName} the details.`}
              </p>
              {businessAddress ? (
                <address className="mb-5 flex items-start gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm not-italic leading-relaxed text-stone-700">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-ts-orange" />
                  <span>{businessAddress}</span>
                </address>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={startCall}
                  disabled={busy || !allowCall}
                  className="flex min-h-32 flex-col items-start justify-between rounded-2xl bg-ts-orange p-5 text-left text-white transition-transform hover:-translate-y-0.5 hover:bg-ts-orange-dark disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Phone className="h-6 w-6" />
                  )}
                  <span>
                    <strong className="block text-lg">
                      {hasSeparateOperator && operatorRole ? `Call ${operatorRole}` : "Call"}
                    </strong>
                    {!allowCall ? (
                      <span className="text-sm text-white/80">Calling is coming soon</span>
                    ) : hasSeparateOperator ? (
                      <span className="text-sm text-white/80">Connect with {operatorName}</span>
                    ) : null}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setView("request");
                  }}
                  className="flex min-h-32 flex-col items-start justify-between rounded-2xl border-2 border-ts-orange/25 bg-white p-5 text-left text-neutral-900 transition-transform hover:-translate-y-0.5 hover:border-ts-orange/60"
                >
                  <MessageCircle className="h-6 w-6 text-ts-orange" />
                  <span>
                    <strong className="block text-lg">Fill out the form</strong>
                  </span>
                </button>
              </div>
              {deliveryCustody === "tradescout_pending_owner" ? (
                <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                  Requests are saved until {businessName} connects.
                </p>
              ) : null}
            </div>
          ) : null}

          {view === "request" ? (
            <form onSubmit={submitRequest} className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-neutral-900">
                  {selectedServiceName
                    ? `Ask about ${selectedServiceName}`
                    : multiStoneSelections.length
                      ? `Ask about ${multiStoneSelections.length} saved stones`
                      : displayStoneName
                        ? `Ask about ${displayStoneName}`
                        : stableItemId
                          ? "Ask about this stone selection"
                          : config.heading}
                </h3>
                {multiStoneSelections.length ? (
                  <ul
                    className="mt-3 grid gap-1 text-sm text-stone-600 sm:grid-cols-2"
                    aria-label="Selected stones"
                  >
                    {multiStoneSelections.slice(0, 8).map((selection) => (
                      <li key={selection.itemId} className="truncate">
                        {selection.stoneName}
                      </li>
                    ))}
                    {multiStoneSelections.length > 8 ? (
                      <li>And {multiStoneSelections.length - 8} more</li>
                    ) : null}
                  </ul>
                ) : null}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-neutral-900">Name</span>
                <input
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="w-full rounded-xl border border-black/15 !bg-white px-4 py-3 !text-neutral-900 outline-none placeholder:!text-stone-400 focus:border-ts-orange"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-neutral-900">Email</span>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className="w-full rounded-xl border border-black/15 !bg-white px-4 py-3 !text-neutral-900 outline-none placeholder:!text-stone-400 focus:border-ts-orange"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    Phone <span className="text-xs font-normal text-stone-600">Required</span>
                  </span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    name="phone"
                    aria-required="true"
                    placeholder="(555) 555-5555"
                    value={form.phone}
                    onChange={(event) => {
                      setError("");
                      setForm({ ...form, phone: event.target.value });
                    }}
                    className="w-full rounded-xl border border-black/15 !bg-white px-4 py-3 !text-neutral-900 outline-none placeholder:!text-stone-400 focus:border-ts-orange"
                  />
                </label>
              </div>
              {requestMode === "materials" ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-neutral-900">
                    I am a…
                  </span>
                  <select
                    required
                    value={form.customerRole}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        customerRole: event.target.value as ExpressDirectConnectCustomerRole | "",
                      })
                    }
                    className="w-full rounded-xl border border-black/15 !bg-white px-4 py-3 !text-neutral-900 outline-none focus:border-ts-orange"
                  >
                    <option value="" disabled>
                      Select one
                    </option>
                    {MATERIALS_CUSTOMER_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-neutral-900">
                  What do you need?
                </span>
                <select
                  value={form.requestType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      requestType: event.target.value as ExpressDirectConnectRequestType,
                    })
                  }
                  className="w-full rounded-xl border border-black/15 !bg-white px-4 py-3 !text-neutral-900 outline-none focus:border-ts-orange"
                >
                  {config.requestTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-neutral-900">Details</span>
                <textarea
                  required
                  rows={5}
                  minLength={10}
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  placeholder={config.placeholder}
                  className="w-full resize-y rounded-xl border border-black/15 !bg-white px-4 py-3 !text-neutral-900 outline-none placeholder:!text-stone-400 focus:border-ts-orange"
                />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={form.updatesOptIn}
                  onChange={(event) => setForm({ ...form, updatesOptIn: event.target.checked })}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-black/30 text-ts-orange focus:ring-ts-orange"
                />
                <span className="text-sm leading-6 text-stone-700">{updatesOptInLabel}</span>
              </label>
              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
                className="absolute -left-[10000px] h-px w-px opacity-0"
              />
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-ts-orange px-7 py-3.5 font-bold text-white transition-colors hover:bg-ts-orange-dark disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <MessageCircle className="h-5 w-5" />
                )}
                Make A Request
              </button>
            </form>
          ) : null}

          {view === "call_started" ? (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-ts-orange/10 text-ts-orange">
                <Phone className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900">Calling {operatorName}</h3>
              {callTel ? (
                <a
                  href={callTel}
                  className="mt-3 inline-block text-lg font-bold text-neutral-900 underline underline-offset-4"
                >
                  {callPhone || "Call again"}
                </a>
              ) : null}
              {stayInProfile ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-7 w-full rounded-xl px-6 py-3 text-sm font-semibold text-stone-600 transition-colors hover:text-neutral-900"
                >
                  Back to {businessName}
                </button>
              ) : null}
            </div>
          ) : null}

          {view === "success" ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-5 h-14 w-14 text-emerald-600" />
              <h3 className="text-2xl font-bold text-neutral-900">
                {requestDeliveryCustody === "tradescout_pending_owner"
                  ? "Request saved"
                  : "Request sent"}
              </h3>
              {requestDeliveryCustody !== "tradescout_pending_owner" ? (
                <p className="mx-auto mt-2 max-w-md text-stone-600">
                  {hasSeparateOperator
                    ? `Your ${businessName} request was sent to ${operatorName}.`
                    : `${businessName} received your project details.`}
                </p>
              ) : null}

              {hasViewerSession ? (
                requiresDocumentNavigation(requestHref) ? (
                  <a
                    href={requestHref}
                    className="mt-6 inline-block rounded-xl bg-ts-orange px-7 py-3 font-semibold text-white transition-colors hover:bg-ts-orange-dark"
                  >
                    Manage this request
                  </a>
                ) : (
                  <Link
                    href={requestHref}
                    className="mt-6 inline-block rounded-xl bg-ts-orange px-7 py-3 font-semibold text-white transition-colors hover:bg-ts-orange-dark"
                  >
                    Manage this request
                  </Link>
                )
              ) : stayInProfile ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 w-full rounded-xl px-6 py-3 text-sm font-semibold text-stone-600 transition-colors hover:text-neutral-900"
                >
                  Back to {businessName}
                </button>
              ) : null}
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
