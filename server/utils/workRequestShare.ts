export function redactContactDetails(input: string): string {
  const text = String(input || "");
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[hidden]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[hidden]");
}

export function buildWorkRequestScopeSummary(input: string, maxLength = 220): string {
  const redacted = redactContactDetails(input).replace(/\s+/g, " ").trim();
  if (!redacted) return "";
  if (redacted.length <= maxLength) return redacted;
  return `${redacted.slice(0, maxLength - 1).trimEnd()}...`;
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
