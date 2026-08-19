export const PROFILE_ACCOUNT_ROLES = [
  "customer",
  "fabricator",
  "builder_contractor",
  "designer",
  "stone_yard_dealer",
  "supplier",
  "trade_professional",
  "member",
] as const;

export type ProfileAccountRole = (typeof PROFILE_ACCOUNT_ROLES)[number];

export const PROFILE_ACCOUNT_ROLE_LABELS: Readonly<Record<ProfileAccountRole, string>> = {
  customer: "Customer",
  fabricator: "Fabricator",
  builder_contractor: "Builder or contractor",
  designer: "Designer",
  stone_yard_dealer: "Stone yard or dealer",
  supplier: "Supplier",
  trade_professional: "Trade professional",
  member: "Member",
};

export const PROFILE_ACCOUNT_BUSINESS_ROLES = [
  "fabricator",
  "builder_contractor",
  "designer",
  "stone_yard_dealer",
  "supplier",
  "trade_professional",
] as const satisfies readonly ProfileAccountRole[];

export const PROFILE_ACCOUNT_BIDROCK_ROLES = [
  "fabricator",
  "builder_contractor",
  "designer",
  "stone_yard_dealer",
  "supplier",
] as const satisfies readonly ProfileAccountRole[];

export type ProfileAccountPolicy = Readonly<{
  enabled: boolean;
  profileSlug: string;
  kind: "profile" | "business" | "stone_business";
  defaultRole: ProfileAccountRole;
  roles: readonly ProfileAccountRole[];
  label: string;
  heading: string;
  description: string;
}>;

const STONE_PROFILE_SLUGS = new Set(["jw-stone", "issa-build", "red-graniti"]);
const STONE_MATERIAL_TERMS = new Set([
  "stone",
  "natural-stone",
  "engineered-stone",
  "granite",
  "marble",
  "quartz",
  "quartzite",
  "onyx",
  "soapstone",
  "travertine",
  "limestone",
  "dolomite",
  "porcelain",
  "sintered-stone",
  "slab",
  "slabs",
]);

function normalizeSlug(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function contentContainsStone(contentBlocks: unknown): boolean {
  for (const block of readArray(contentBlocks)) {
    if (!block || typeof block !== "object") continue;
    const record = block as Record<string, unknown>;
    if (String(record.type || "") !== "inventoryCatalog") continue;
    const data =
      record.data && typeof record.data === "object"
        ? (record.data as Record<string, unknown>)
        : {};
    for (const category of readArray(data.categories)) {
      if (!category || typeof category !== "object") continue;
      const categoryRecord = category as Record<string, unknown>;
      const candidates = [
        categoryRecord.categorySlug,
        categoryRecord.category,
        categoryRecord.title,
        categoryRecord.material,
      ];
      if (candidates.some((candidate) => STONE_MATERIAL_TERMS.has(normalizeSlug(candidate)))) {
        return true;
      }
    }
  }
  return false;
}

export function isProfileAccountRole(value: unknown): value is ProfileAccountRole {
  return PROFILE_ACCOUNT_ROLES.includes(String(value || "") as ProfileAccountRole);
}

export function isProfileAccountBusinessRole(
  value: ProfileAccountRole
): value is (typeof PROFILE_ACCOUNT_BUSINESS_ROLES)[number] {
  return PROFILE_ACCOUNT_BUSINESS_ROLES.includes(
    value as (typeof PROFILE_ACCOUNT_BUSINESS_ROLES)[number]
  );
}

export function profileAccountRoleIncludesBidRock(value: ProfileAccountRole): boolean {
  return PROFILE_ACCOUNT_BIDROCK_ROLES.includes(
    value as (typeof PROFILE_ACCOUNT_BIDROCK_ROLES)[number]
  );
}

export function resolveProfileAccountPolicy(args: {
  profileSlug: string;
  profileName?: string | null;
  hasBusiness?: boolean;
  contentBlocks?: unknown;
}): ProfileAccountPolicy {
  const profileSlug = normalizeSlug(args.profileSlug);
  const profileName = String(args.profileName || "this profile").trim() || "this profile";
  const stoneBusiness =
    STONE_PROFILE_SLUGS.has(profileSlug) || contentContainsStone(args.contentBlocks);

  if (stoneBusiness) {
    return Object.freeze({
      enabled: true,
      profileSlug,
      kind: "stone_business" as const,
      defaultRole: profileSlug === "jw-stone" ? ("fabricator" as const) : ("customer" as const),
      roles: Object.freeze([
        "customer",
        "fabricator",
        "builder_contractor",
        "designer",
        "stone_yard_dealer",
        "supplier",
      ] as const),
      label: `${profileName} account`,
      heading: `Create an account with ${profileName}`,
      description:
        "Use one TradeScout sign-in for this profile. Business access remains pending until verification is complete.",
    });
  }

  if (args.hasBusiness) {
    return Object.freeze({
      enabled: true,
      profileSlug,
      kind: "business" as const,
      defaultRole: "customer" as const,
      roles: Object.freeze(["customer", "trade_professional"] as const),
      label: `${profileName} account`,
      heading: `Create an account with ${profileName}`,
      description:
        "Keep your relationship with this business connected to one TradeScout sign-in.",
    });
  }

  return Object.freeze({
    enabled: true,
    profileSlug,
    kind: "profile" as const,
    defaultRole: "member" as const,
    roles: Object.freeze(["member"] as const),
    label: `${profileName} account`,
    heading: `Create an account with ${profileName}`,
    description: "Keep this profile connected to one TradeScout sign-in.",
  });
}

export function buildProfileAccountReturnPath(args: {
  profileSlug: string;
  role?: ProfileAccountRole | null;
}): string {
  const profileSlug = normalizeSlug(args.profileSlug);
  const role = args.role && isProfileAccountRole(args.role) ? args.role : null;
  const params = new URLSearchParams({ profileAccount: "1" });
  if (role) params.set("role", role);
  return `/u/${encodeURIComponent(profileSlug)}?${params.toString()}`;
}
