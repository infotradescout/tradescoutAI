import {
  extractDirectConnectPhoneDigits,
  isValidDirectConnectRequestPhone,
} from "@shared/directConnectPhone";

export type DirectConnectPhone = {
  display: string;
  tel: string;
};

export { isValidDirectConnectRequestPhone };

export function normalizeDirectConnectPhone(raw: unknown): DirectConnectPhone | null {
  const display = String(raw || "").trim();
  if (!isValidDirectConnectRequestPhone(display)) return null;

  const digits = extractDirectConnectPhoneDigits(display);
  const e164 =
    digits.length === 10
      ? `+1${digits}`
      : digits.length === 11 && digits.startsWith("1")
        ? `+${digits}`
        : `+${digits}`;

  return { display, tel: `tel:${e164}` };
}

export function hasDirectConnectPhone(raw: unknown): boolean {
  return isValidDirectConnectRequestPhone(raw);
}
