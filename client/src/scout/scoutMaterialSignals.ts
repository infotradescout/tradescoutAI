export type ScoutMaterialCategory = {
  key: string;
  label: string;
  exchangePath: string;
  products: string[];
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => {
    const normalizedTerm = normalize(term);
    if (!normalizedTerm) return false;
    return new RegExp(`(^|\\s)${normalizedTerm.replace(/\s+/g, "\\s+")}(\\s|$)`).test(text);
  });
}

export function hasMaterialOrSupplierIntent(rawValue: string): boolean {
  const text = normalize(rawValue);
  if (!text) return false;
  return hasAny(text, [
    "material",
    "materials",
    "supply",
    "supplies",
    "supplier",
    "suppliers",
    "parts",
    "product",
    "products",
    "lowes",
    "lowe s",
    "home depot",
    "lumber",
    "deck",
    "decking",
    "joist",
    "fastener",
    "fasteners",
    "concrete",
    "pipe",
    "wire",
    "breaker",
    "shingle",
    "order",
    "pickup",
    "delivery",
  ]);
}

export function inferMaterialCategory(rawValue: string): ScoutMaterialCategory {
  const text = normalize(rawValue);

  if (hasAny(text, ["deck", "decking", "porch", "patio", "lumber", "joist", "railing"])) {
    return {
      key: "deck",
      label: "Deck materials",
      exchangePath: "/exchange/construction",
      products: ["lumber", "deck boards", "fasteners", "joist hangers", "concrete footings"],
    };
  }

  if (hasAny(text, ["concrete", "driveway", "slab", "sidewalk", "rebar", "forms"])) {
    return {
      key: "concrete",
      label: "Concrete materials",
      exchangePath: "/exchange/construction",
      products: ["ready-mix or bags", "rebar", "form boards", "gravel", "control joints"],
    };
  }

  if (hasAny(text, ["roof", "roofing", "shingle", "underlayment", "flashing", "gutter"])) {
    return {
      key: "roofing",
      label: "Roofing materials",
      exchangePath: "/exchange/construction",
      products: ["shingles", "underlayment", "flashing", "drip edge", "roofing fasteners"],
    };
  }

  if (hasAny(text, ["plumb", "pipe", "valve", "drain", "water heater", "fitting"])) {
    return {
      key: "plumbing",
      label: "Plumbing parts",
      exchangePath: "/exchange/tools",
      products: ["pipe", "fittings", "valves", "couplings", "water heater parts"],
    };
  }

  if (hasAny(text, ["electric", "wire", "breaker", "panel", "outlet", "conduit", "gfci"])) {
    return {
      key: "electrical",
      label: "Electrical parts",
      exchangePath: "/exchange/tools",
      products: ["wire", "breakers", "boxes", "GFCI devices", "conduit"],
    };
  }

  return {
    key: "general",
    label: "Materials and products",
    exchangePath: "/exchange/tools",
    products: ["materials", "parts", "tools", "hardware", "supplier links"],
  };
}

export function materialProductSummary(rawValue: string): string {
  const category = inferMaterialCategory(rawValue);
  return category.products.slice(0, 5).join(", ");
}
