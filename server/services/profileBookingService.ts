type ProfileBookingSlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string;
  active: boolean;
};

type ProfilePricingRow = {
  id: string;
  name: string;
  priceLabel: string;
  description: string;
};

export type NormalizedProfileBookingPrefs = {
  enabled: boolean;
  paidBookings: boolean;
  bookingPriceUsd: number;
  calendarVisibility: "public" | "private";
  timezone: string;
  slots: ProfileBookingSlot[];
  pricingTableEnabled: boolean;
  pricingRows: ProfilePricingRow[];
};

export const normalizeProfileBookingPrefs = (raw: unknown): NormalizedProfileBookingPrefs => {
  const source = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const enabled = source.enabled === true;
  const paidBookings = source.paidBookings === true;
  const calendarVisibility = source.calendarVisibility === "private" ? "private" : "public";
  const timezone =
    typeof source.timezone === "string" && source.timezone.trim().length > 0
      ? source.timezone.trim().slice(0, 80)
      : "America/Chicago";
  const bookingPriceUsdRaw = Number(source.bookingPriceUsd);
  const bookingPriceUsd =
    Number.isFinite(bookingPriceUsdRaw) && bookingPriceUsdRaw >= 0
      ? Number(bookingPriceUsdRaw.toFixed(2))
      : 0;
  const pricingTableEnabled = source.pricingTableEnabled === true;

  const slots: ProfileBookingSlot[] = Array.isArray(source.slots)
    ? source.slots
        .filter((slot) => slot && typeof slot === "object")
        .map((slot: any) => ({
          id:
            typeof slot.id === "string" && slot.id.trim().length > 0
              ? slot.id.trim().slice(0, 80)
              : "",
          dayOfWeek:
            typeof slot.dayOfWeek === "number" && slot.dayOfWeek >= 0 && slot.dayOfWeek <= 6
              ? slot.dayOfWeek
              : 0,
          startTime:
            typeof slot.startTime === "string" && /^\d{2}:\d{2}$/.test(slot.startTime)
              ? slot.startTime
              : "09:00",
          endTime:
            typeof slot.endTime === "string" && /^\d{2}:\d{2}$/.test(slot.endTime)
              ? slot.endTime
              : "17:00",
          label: typeof slot.label === "string" ? slot.label.trim().slice(0, 80) : "",
          active: slot.active !== false,
        }))
        .filter((slot) => slot.id.length > 0)
        .slice(0, 120)
    : [];

  const pricingRows: ProfilePricingRow[] = Array.isArray(source.pricingRows)
    ? source.pricingRows
        .filter((row) => row && typeof row === "object")
        .map((row: any) => ({
          id:
            typeof row.id === "string" && row.id.trim().length > 0
              ? row.id.trim().slice(0, 80)
              : "",
          name: typeof row.name === "string" ? row.name.trim().slice(0, 80) : "",
          priceLabel: typeof row.priceLabel === "string" ? row.priceLabel.trim().slice(0, 40) : "",
          description:
            typeof row.description === "string" ? row.description.trim().slice(0, 240) : "",
        }))
        .filter((row) => row.id.length > 0 && row.name.length > 0 && row.priceLabel.length > 0)
        .slice(0, 32)
    : [];

  return {
    enabled,
    paidBookings,
    bookingPriceUsd,
    calendarVisibility,
    timezone,
    slots,
    pricingTableEnabled,
    pricingRows,
  };
};

export const toPublicProfileBookingPrefs = (raw: unknown): NormalizedProfileBookingPrefs => {
  const normalized = normalizeProfileBookingPrefs(raw);
  return {
    ...normalized,
    slots: normalized.calendarVisibility === "public" ? normalized.slots : [],
  };
};

const LOUISIANA_REMOTE_ELIGIBLE = new Set([
  "acknowledgment",
  "jurat",
  "affidavit",
  "power_of_attorney",
]);

type NotaryGateInput = {
  owner: {
    verificationStatus?: string | null;
    addressVerified?: boolean | null;
    role?: string | null;
    roles?: string[] | null;
    preferences?: any;
  };
  bookingContext?: {
    category?: string;
    stateCode?: string;
    serviceType?: string;
    deliveryMode?: string;
  } | null;
  paidBooking: boolean;
};

export const evaluateNotaryPaidRemoteGate = (input: NotaryGateInput) => {
  const category = String(input.bookingContext?.category || "").toLowerCase();
  const stateCode = String(input.bookingContext?.stateCode || "").toUpperCase();
  const deliveryMode = String(input.bookingContext?.deliveryMode || "").toLowerCase();
  const serviceType = String(input.bookingContext?.serviceType || "")
    .trim()
    .toLowerCase();

  const gateApplies =
    input.paidBooking &&
    category === "legal_notary" &&
    stateCode === "LA" &&
    deliveryMode === "remote";

  if (!gateApplies) {
    return { allowed: true as const, applied: false as const, missing: [] as string[] };
  }

  const roles = new Set([
    String(input.owner.role || "").toLowerCase(),
    ...(Array.isArray(input.owner.roles) ? input.owner.roles : []).map((role) =>
      String(role || "").toLowerCase()
    ),
  ]);

  const notaryPrefs = (input.owner.preferences?.notaryVerification || {}) as {
    commissionActive?: boolean;
    backgroundScreened?: boolean;
    remoteProviderCertified?: boolean;
  };

  const missing: string[] = [];
  if (String(input.owner.verificationStatus || "").toLowerCase() !== "approved") {
    missing.push("platform_verification_approved");
  }
  if (!input.owner.addressVerified) {
    missing.push("address_verified");
  }
  if (!roles.has("notary") && !roles.has("remote_notary") && !roles.has("mobile_notary")) {
    missing.push("notary_role_claimed");
  }
  if (!notaryPrefs.commissionActive) {
    missing.push("notary_commission_active");
  }
  if (!notaryPrefs.backgroundScreened) {
    missing.push("notary_background_screened");
  }
  if (!notaryPrefs.remoteProviderCertified) {
    missing.push("remote_provider_certified");
  }
  if (!LOUISIANA_REMOTE_ELIGIBLE.has(serviceType)) {
    missing.push("remote_service_type_eligible");
  }

  return {
    allowed: missing.length === 0,
    applied: true as const,
    missing,
    requiredUploads: [
      "government_id_front",
      "government_id_back",
      "signer_selfie",
      "unsigned_document_pdf",
    ],
  };
};
