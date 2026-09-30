export type SearchableProfileTemplate = {
  id: string;
  label: string;
  description: string;
  bestFor?: string;
  family?: string;
};

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US");
}

/** Filter the canonical catalog without adding, reordering, or modifying templates. */
export function filterProfileTemplates<T extends SearchableProfileTemplate>(
  templates: readonly T[],
  query: string
): T[] {
  const terms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [...templates];
  return templates.filter((template) => {
    const text = normalizeSearch(`${template.id} ${template.label} ${template.description} ${template.bestFor || ""} ${template.family || ""}`);
    return terms.every((term) => text.includes(term));
  });
}
