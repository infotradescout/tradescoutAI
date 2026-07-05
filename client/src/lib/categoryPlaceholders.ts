export const DEFAULT_CATEGORY_PLACEHOLDER_SLUG = "general-contractor";

const CATEGORY_ALIAS_PATTERNS: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /\bplumb(er|ing)?\b/, slug: "plumbing" },
  { pattern: /\belectric(ian|al)?\b/, slug: "electrical" },
  { pattern: /\bhvac|heating|cooling|air\s*conditioning\b/, slug: "hvac" },
  { pattern: /\broof(ing|er)?\b/, slug: "roofing" },
  { pattern: /\bpaint(ing|er)?\b/, slug: "painting" },
  { pattern: /\bfloor(ing)?\b/, slug: "flooring" },
  { pattern: /\bdrywall\b/, slug: "drywall" },
  { pattern: /\bhandyman\b/, slug: "handyman" },
  { pattern: /\bgeneral\s*contractor|contractor\b/, slug: "general-contractor" },
  { pattern: /\bconcrete|masonry\b/, slug: "masonry-concrete" },
  { pattern: /\blandscap|lawn\b/, slug: "landscaping-lawn-care" },
  { pattern: /\btree\b/, slug: "tree-service" },
  { pattern: /\bpest\b/, slug: "pest-control" },
  { pattern: /\blocksmith\b/, slug: "locksmith" },
  { pattern: /\bremodel|kitchen|bath\b/, slug: "kitchen-bath-remodel" },
  { pattern: /\bclean(ing)?|janitorial\b/, slug: "cleaning-janitorial" },
  { pattern: /\bauto|mechanic|car\b/, slug: "auto-repair" },
  { pattern: /\bbookkeep|accounting|cpa|tax\b/, slug: "accounting-cpa" },
  { pattern: /\blegal|attorney|law\b/, slug: "legal-services" },
  { pattern: /\binsurance\b/, slug: "insurance-agency" },
  { pattern: /\bmortgage|lending\b/, slug: "mortgage-lending" },
  { pattern: /\breal\s*estate|realtor\b/, slug: "real-estate-agents" },
  { pattern: /\bproperty\s*management\b/, slug: "property-management" },
  { pattern: /\bconsult(ing)?\b/, slug: "consulting" },
  { pattern: /\bmarketing\b/, slug: "marketing-agency" },
  { pattern: /\bweb\s*design|website\b/, slug: "web-design" },
  { pattern: /\bseo\b/, slug: "seo-local-search" },
  { pattern: /\bgraphic\s*design\b/, slug: "graphic-design" },
  { pattern: /\bsoftware|saas\b/, slug: "software-services" },
  { pattern: /\bit\s*support|managed\s*services\b/, slug: "it-support" },
  { pattern: /\bfitness|gym|trainer\b/, slug: "fitness-gym" },
  { pattern: /\bbarber\b/, slug: "barber-shop" },
  { pattern: /\bsalon\b/, slug: "hair-salon" },
  { pattern: /\bnail\b/, slug: "nail-salon" },
  { pattern: /\bspa|skincare\b/, slug: "spa-skincare" },
  { pattern: /\bdental\b/, slug: "dental-clinic" },
  { pattern: /\bmedical\b/, slug: "medical-clinic" },
  { pattern: /\bmental\s*health|counsel\b/, slug: "mental-health-counseling" },
  { pattern: /\bpet\s*groom|grooming\b/, slug: "pet-grooming" },
  { pattern: /\bvet|veterinary\b/, slug: "veterinary-clinic" },
  { pattern: /\bdog\s*train\b/, slug: "dog-training" },
  { pattern: /\bchildcare|preschool|daycare\b/, slug: "childcare-preschool" },
  { pattern: /\bmusic\s*lessons\b/, slug: "music-lessons" },
  { pattern: /\bdance\b/, slug: "dance-studio" },
  { pattern: /\bmartial\s*arts\b/, slug: "martial-arts" },
  { pattern: /\bevent\b/, slug: "event-planning" },
  { pattern: /\bphotography|video\b/, slug: "photography-video" },
  { pattern: /\bflorist|floral\b/, slug: "florist-event-design" },
  { pattern: /\bwarehouse|logistics\b/, slug: "warehouse-logistics" },
  { pattern: /\bsecurity\b/, slug: "security-guards" },
  { pattern: /\bwaste|recycling\b/, slug: "waste-recycling" },
  { pattern: /\bdumpster\b/, slug: "dumpster-rental" },
];

function normalizeCategoryCandidate(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ");
}

export function resolveCategoryPlaceholderSlug(
  categoryCandidates: Array<string | null | undefined>
): string {
  for (const raw of categoryCandidates) {
    const candidate = normalizeCategoryCandidate(raw || "");
    if (!candidate) continue;

    for (const { pattern, slug } of CATEGORY_ALIAS_PATTERNS) {
      if (pattern.test(candidate)) return slug;
    }
  }

  return DEFAULT_CATEGORY_PLACEHOLDER_SLUG;
}

export function getCategoryPlaceholderSrc(
  categoryCandidates: Array<string | null | undefined>
): string {
  const slug = resolveCategoryPlaceholderSlug(categoryCandidates);
  return `/images/tradescout/categories/${slug}.svg`;
}
