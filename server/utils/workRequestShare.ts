export function redactContactDetails(input: string): string {
  const text = String(input || "");
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[hidden]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[hidden]");
}

export type DirectConnectReleasedContactPayload = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
};

function cleanReleasedContactField(value: unknown): string | undefined {
  const cleaned = String(value || "").trim();
  return cleaned || undefined;
}

export function normalizeDirectConnectReleasedContact(
  releasedContact?: DirectConnectReleasedContactPayload | null
): DirectConnectReleasedContactPayload | null {
  if (!releasedContact || typeof releasedContact !== "object") return null;
  const normalized = {
    name: cleanReleasedContactField(releasedContact.name),
    phone: cleanReleasedContactField(releasedContact.phone),
    email: cleanReleasedContactField(releasedContact.email),
    address: cleanReleasedContactField(releasedContact.address),
    notes: cleanReleasedContactField(releasedContact.notes),
  };
  const hasReleasedContact = Object.values(normalized).some(Boolean);
  return hasReleasedContact ? normalized : null;
}

export function serializeDirectConnectCardContactGatePayload(args: {
  contactGateState?: unknown;
  releasedContact?: DirectConnectReleasedContactPayload | null;
}): {
  contactGateState: string;
  releasedContact?: DirectConnectReleasedContactPayload;
} {
  const contactGateState =
    String(args.contactGateState || "")
      .trim()
      .toLowerCase() || "locked";
  const payload: {
    contactGateState: string;
    releasedContact?: DirectConnectReleasedContactPayload;
  } = { contactGateState };

  if (contactGateState === "released" || contactGateState === "contact_released") {
    const releasedContact = normalizeDirectConnectReleasedContact(args.releasedContact);
    if (releasedContact) {
      payload.releasedContact = releasedContact;
    }
  }

  return payload;
}

export function buildWorkRequestScopeSummary(input: string, maxLength = 220): string {
  const redacted = redactContactDetails(input).replace(/\s+/g, " ").trim();
  if (!redacted) return "";
  if (redacted.length <= maxLength) return redacted;
  return `${redacted.slice(0, maxLength - 1).trimEnd()}...`;
}

export function buildWorkRequestPreviewTitle(input: string, fallback = "Shared request"): string {
  const cleaned = redactContactDetails(input).replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  if (cleaned.length <= 90) return cleaned;
  return `${cleaned.slice(0, 89).trimEnd()}...`;
}

function formatCurrencyValue(raw: unknown): string | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function formatBudgetRange(budgetMin: unknown, budgetMax: unknown): string | null {
  const min = formatCurrencyValue(budgetMin);
  const max = formatCurrencyValue(budgetMax);
  if (min && max) return `${min}-${max}`;
  if (min) return `${min}+`;
  if (max) return `Up to ${max}`;
  return null;
}
