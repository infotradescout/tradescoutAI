export type DirectConnectPhone = {
  display: string;
  tel: string;
};

export function normalizeDirectConnectPhone(raw: unknown): DirectConnectPhone | null {
  const display = String(raw || "").trim();
  const digits = display.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;

  const e164 =
    digits.length === 10
      ? `+1${digits}`
      : digits.length === 11 && digits.startsWith("1")
        ? `+${digits}`
        : `+${digits}`;

  return { display, tel: `tel:${e164}` };
}

export function hasDirectConnectPhone(raw: unknown): boolean {
  return normalizeDirectConnectPhone(raw) !== null;
}
