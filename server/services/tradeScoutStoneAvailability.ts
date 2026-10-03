/** TradeScout-owned supplier-neutral stone commerce helpers. */
export function unheldStoneUnitCount(quantity: unknown, heldQuantity: unknown): number | null {
  const count = (value: unknown): number | null => {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string" && !/^\d+(?:\.0+)?$/.test(value.trim())) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  };
  const physical = count(quantity);
  const held = count(heldQuantity);
  if (physical === null || held === null || held > physical) return null;
  return physical - held;
}
