import { sanitizePublicListingText } from "@shared/publicListingSafety";
import { getCountyByFips } from "@shared/states-counties";
import { formatBudgetRange } from "../utils/workRequestShare";

type AssignedRequest = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  countyFips?: unknown;
  stateCode?: unknown;
  budgetMin?: unknown;
  budgetMax?: unknown;
  attachments?: unknown;
};

function safePublicOrigin(value: string): string {
  try {
    const origin = new URL(value);
    if (origin.protocol === "https:" || origin.protocol === "http:") return origin.origin;
  } catch {
    // A missing or invalid deployment URL falls back to the canonical origin.
  }
  return "https://www.thetradescout.com";
}

/** Only call after the notification job has verified this assignment and recipient. */
export function buildAssignedProviderEmailContent(
  request: AssignedRequest,
  assignmentId: string,
  appOrigin: string
) {
  const title = sanitizePublicListingText(request.title, 120) || "Direct Connect request";
  const description = sanitizePublicListingText(request.description, 1600);
  const category = sanitizePublicListingText(request.category, 80).replace(/[_-]+/g, " ");
  const countyFips = String(request.countyFips || "");
  const county = /^\d{5}$/.test(countyFips) ? getCountyByFips(countyFips) : undefined;
  const stateCode = String(request.stateCode || "").toUpperCase();
  const area =
    county && (!stateCode || county.state === stateCode)
      ? `${county.name}, ${county.state}`
      : /^[A-Z]{2}$/.test(stateCode)
        ? stateCode
        : "";
  const budget = formatBudgetRange(request.budgetMin, request.budgetMax);
  const attachmentCount = Array.isArray(request.attachments) ? request.attachments.length : 0;
  const actionUrl = `/direct-connect/inbox?filter=all&selected=${encodeURIComponent(assignmentId)}`;
  const reviewUrl = new URL(actionUrl, safePublicOrigin(appOrigin)).href;
  const message = [
    `Request: ${title}`,
    description ? `Details: ${description}` : null,
    category ? `Category: ${category}` : null,
    area ? `Service area: ${area}` : null,
    budget ? `Budget: ${budget}` : null,
    attachmentCount ? `Attachments: ${attachmentCount}` : null,
    `Review this request in Direct Connect to accept or decline it: ${reviewUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    title: `New Direct Connect request: ${title}`,
    message,
    actionUrl,
    actionText: "Review and respond",
  };
}
