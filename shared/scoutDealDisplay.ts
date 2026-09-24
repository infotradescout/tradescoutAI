/** Keep posted promotion timing identical across Scout and its public detail page. */
export function formatPostedDealEndTime(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
