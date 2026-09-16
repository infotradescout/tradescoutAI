export type JwStoneFulfillmentDetails = Readonly<{
  requestedDate: string;
  timePreference: "flexible" | "morning" | "afternoon";
  destinationType: "not_specified" | "business" | "jobsite" | "residential";
  addressLine: string;
  city: string;
  stateCode: string;
  unloading: "not_specified" | "equipment_available" | "needs_arrangement";
  notes: string;
}>;

export const EMPTY_FULFILLMENT_DETAILS: JwStoneFulfillmentDetails = Object.freeze({
  requestedDate: "", timePreference: "flexible", destinationType: "not_specified",
  addressLine: "", city: "", stateCode: "", unloading: "not_specified", notes: "",
});
// Express accepts 3000 characters including its added customer-role prefix.
export const JW_CART_QUOTE_MESSAGE_LIMIT = 2900;
export const fulfillmentDetailsKey = (viewerId: string) =>
  `tradescout:jw-stone:delivery-details:v1:${viewerId}`;

/** Uses the browser's calendar day, not a UTC date that may be tomorrow locally. */
export function localCalendarDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function requestedDateError(value: string, today = localCalendarDate()): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Enter a valid requested date.";
  const date = new Date(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return "Enter a valid requested date.";
  }
  return value < today ? "Choose today or a future date, or leave the date blank for flexible timing." : null;
}

/** A written calendar date remains readable without changing phone/email redaction. */
export function formatRequestedDate(value: string): string {
  if (requestedDateError(value, "0000-01-01") || !value) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function boundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

/** Unknown versions and malformed drafts are retained by the caller, never silently overwritten. */
export function parseFulfillmentDetails(raw: string): JwStoneFulfillmentDetails | null {
  if (raw.length > 6000) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed.schemaVersion !== 1) return null;
    const value = parsed.details;
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        !boundedString(value.requestedDate, 10) || !boundedString(value.addressLine, 180) ||
        !boundedString(value.city, 100) || !boundedString(value.stateCode, 2) ||
        !boundedString(value.notes, 500) ||
        !["flexible", "morning", "afternoon"].includes(value.timePreference) ||
        !["not_specified", "business", "jobsite", "residential"].includes(value.destinationType) ||
        !["not_specified", "equipment_available", "needs_arrangement"].includes(value.unloading)) return null;
    return {
      requestedDate: value.requestedDate, timePreference: value.timePreference,
      destinationType: value.destinationType, addressLine: value.addressLine,
      city: value.city, stateCode: value.stateCode, unloading: value.unloading, notes: value.notes,
    };
  } catch { return null; }
}

const oneLine = (value: string) => value.replace(/[\r\n\t]+/g, " ").trim();

export function fulfillmentDetailsError(details: JwStoneFulfillmentDetails, method: "pickup" | "delivery", today = localCalendarDate()): string | null {
  const dateError = requestedDateError(details.requestedDate, today);
  if (dateError) return dateError;
  if (method === "delivery" && details.stateCode && !/^[A-Za-z]{2}$/.test(details.stateCode)) {
    return "Use a two-letter state abbreviation, or leave the state blank.";
  }
  return null;
}

/** Customer preferences only. No rate, transit duration, dispatch time, or ETA is inferred. */
export function fulfillmentDetailsSummary(details: JwStoneFulfillmentDetails, method: "pickup" | "delivery"): string[] {
  const action = method === "pickup" ? "pickup" : "delivery";
  const lines = [details.requestedDate
    ? `Requested ${action} date: ${formatRequestedDate(details.requestedDate)} (preference only; JW Stone must confirm).`
    : `Requested ${action} timing: flexible; arrange with JW Stone.`];
  if (details.timePreference !== "flexible") lines.push(`Preferred time of day: ${details.timePreference} at the ${method === "pickup" ? "pickup" : "delivery"} location; not a scheduled appointment.`);
  if (method === "delivery") {
    const destinations = { not_specified: "Not specified; please confirm", business: "Business / fabricator shop", jobsite: "Jobsite", residential: "Residential address" };
    const unloading = { not_specified: "Not specified; please confirm requirements", equipment_available: "Equipment available (customer-reported; suitability to be confirmed)", needs_arrangement: "Help arranging unloading requested" };
    lines.push(`Delivery destination type: ${destinations[details.destinationType]}.`);
    const address = [oneLine(details.addressLine), oneLine(details.city), oneLine(details.stateCode).toUpperCase()].filter(Boolean).join(", ");
    if (address) lines.push(`Requested delivery address: ${address} (customer-provided; not yet validated).`);
    lines.push(`Unloading: ${unloading[details.unloading]}.`);
  }
  if (details.notes.trim()) lines.push(`Customer ${action} notes: ${oneLine(details.notes)}`);
  return lines;
}
