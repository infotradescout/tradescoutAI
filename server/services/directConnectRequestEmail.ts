/** Private email presentation. Call only after the canonical assignment and delivery checks. */
export type DirectConnectRequestEmailInput = {
  requestId: string;
  assignmentId: string;
  title: string;
  description: string;
  category?: string | null;
  trade?: string | null;
  location?: string | null;
  jobAddress?: string | null;
  budget?: string | null;
  timing?: string | null;
  requester: { name?: string | null; email?: string | null; phone?: string | null };
  attachmentCount: number;
  origin: string;
};

function line(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

export function buildDirectConnectRequestEmail(input: DirectConnectRequestEmailInput) {
  const requestId = line(input.requestId);
  const assignmentId = line(input.assignmentId);
  if (!requestId || !assignmentId || requestId.length > 120 || assignmentId.length > 120) {
    throw new Error("Direct Connect email requires exact request and assignment identities");
  }
  const origin = new URL(input.origin);
  if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password) {
    throw new Error("Invalid Direct Connect email origin");
  }
  // Incoming workspace selection is the assignment ID, not the request ID.
  const target = new URL("/direct-connect/inbox", origin.origin);
  target.searchParams.set("selected", assignmentId);
  const title = line(input.title) || "Project request";
  const subject = `Direct Connect: ${title}`;
  const fields = [
    title,
    `Request: ${requestId}`,
    `Requester: ${line(input.requester.name) || "Not provided"}`,
    `Phone: ${line(input.requester.phone) || "Not provided"}`,
    `Email: ${line(input.requester.email) || "Not provided"}`,
    line(input.category) ? `Category: ${line(input.category)}` : "",
    line(input.trade) ? `Trade: ${line(input.trade)}` : "",
    line(input.location) ? `Location: ${line(input.location)}` : "",
    line(input.jobAddress) ? `Job address: ${line(input.jobAddress)}` : "",
    line(input.budget) ? `Budget: ${line(input.budget)}` : "",
    line(input.timing) ? `Timing: ${line(input.timing)}` : "",
  ].filter(Boolean);
  if (!Number.isSafeInteger(input.attachmentCount) || input.attachmentCount < 0) {
    throw new Error("Invalid Direct Connect attachment count");
  }
  const scope = typeof input.description === "string" ? input.description.trim() : "";
  return {
    title: subject,
    message: [
      ...fields,
      "",
      "Request details",
      scope || "Not provided",
      "",
      `Photos / files: ${input.attachmentCount}`,
      input.attachmentCount ? "View the request's photos and files using the link below." : "",
      "",
      `Open this request: ${target.href}`,
      "Contact the requester about this request using the details above.",
    ].join("\n"),
    actionUrl: target.pathname + target.search,
    actionText: "Open this request",
  };
}
