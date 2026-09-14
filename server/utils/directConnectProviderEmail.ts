import { getCountyByFips } from "@shared/states-counties";
import { formatBudgetRange } from "./workRequestShare";

export type DirectConnectProviderEmailDetails = {
  creationEvent: {
    id: string;
    type: string;
    actorUserId: string | null;
    metadata: Record<string, any>;
  };
  requester: { id: string; email: string | null };
  contact: { name: string; phone: string };
};

function singleLine(value: unknown): string {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

/** Private assigned-provider presentation, called only after outbox authority validation. */
export function buildDirectConnectProviderEmail(
  request: Record<string, any>,
  assignmentId: string,
  details: DirectConnectProviderEmailDetails
): { title: string; message: string; actionUrl: string; actionText: string } {
  const title = singleLine(request.title) || "Project request";
  const trade = singleLine(request.tradeId) || singleLine(request.category);
  const countyFips = singleLine(request.countyFips);
  const county = countyFips ? getCountyByFips(countyFips) : undefined;
  const state = singleLine(request.stateCode) || county?.state || "";
  const location = [county?.name || (countyFips ? `County ${countyFips}` : ""), state]
    .filter(Boolean)
    .join(", ");
  const budget = formatBudgetRange(request.budgetMin, request.budgetMax);
  const attachments = Array.isArray(request.attachments)
    ? request.attachments.filter((entry: unknown) => typeof entry === "string" && entry.trim()).length
    : null;
  // Do not redact private scope with public-share helpers. Address, timing and
  // other details entered in scope remain intact; no saved home address is read.
  const scope = typeof request.description === "string" ? request.description.trim() : "";
  const lines = [
    `Request: ${title}`,
    trade ? `Trade/category: ${trade}` : "",
    location ? `Service area: ${location}` : "",
    budget ? `Budget: ${budget}` : "",
    attachments !== null
      ? `Attachments/photos: ${attachments}. Open this request to view the files.`
      : "",
    "",
    "Requester contact",
    `Name: ${singleLine(details.contact.name)}`,
    `Phone: ${singleLine(details.contact.phone)}`,
    // Standard authenticated requests capture name/phone on submission. Their
    // account email is explicitly labelled, not misrepresented as a saved receipt.
    details.requester.email ? `Account email: ${singleLine(details.requester.email)}` : "",
    "",
    "Scope and job details",
    scope,
  ];
  const query = new URLSearchParams({
    selected: assignmentId,
    filter: "all",
    county: /^\d{5}$/.test(countyFips) ? countyFips : "",
  });
  return {
    title: Array.from(`Direct Connect${trade ? ` — ${trade}` : ""}: ${title}`).slice(0, 240).join(""),
    message: lines.join("\n"),
    // These are the existing inbox workspace's canonical selection keys.
    actionUrl: `/direct-connect/inbox?${query}`,
    actionText: "Open this request",
  };
}
