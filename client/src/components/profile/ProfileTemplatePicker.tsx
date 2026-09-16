import { useId, useMemo, useState, type FormEvent } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listSelectableProfileSiteTemplates } from "@shared/profileSiteTemplates";
import type {
  ProfileSiteTemplateGalleryId,
  ProfileSiteTemplateId,
} from "@shared/profileSiteTemplates";
import { filterProfileTemplates } from "./profileTemplateSearch";

type Props = {
  currentTemplate: ProfileSiteTemplateId;
  saving: boolean;
  hasUnsavedEdits: boolean;
  onApply: (templateId: ProfileSiteTemplateGalleryId) => Promise<boolean>;
  onClose: () => void;
};

/** Preview a selection before changing the live layout; the catalog remains authoritative. */
export default function ProfileTemplatePicker({
  currentTemplate,
  saving,
  hasUnsavedEdits,
  onApply,
  onClose,
}: Props) {
  const id = useId();
  const templates = useMemo(() => listSelectableProfileSiteTemplates(), []);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<ProfileSiteTemplateGalleryId | null>(
    () => templates.find((template) => template.id === currentTemplate)?.id ?? null
  );
  const results = useMemo(() => filterProfileTemplates(templates, query), [templates, query]);
  const selected = templates.find((template) => template.id === selectedId);
  const canApply = Boolean(selected && selected.id !== currentTemplate && !saving && !hasUnsavedEdits);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canApply && selected) void onApply(selected.id);
  };

  return (
    <form
      onSubmit={submit}
      className="min-w-0 space-y-4 rounded-2xl border border-white/15 bg-black/30 p-4 sm:p-5"
      aria-labelledby={`${id}-title`}
      aria-busy={saving}
      data-testid="profile-template-picker"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <h2 id={`${id}-title`} className="text-base font-bold text-white">Choose a profile template</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/75">
            Browse layouts, then apply your selection. Browsing does not change your live profile.
          </p>
        </div>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}
          className="min-h-11 border-white/20 bg-white/5 text-white hover:bg-white/10">
          Close templates
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-search`} className="text-white/90">Find a template</Label>
        <div className="flex min-w-0 gap-2">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/60" />
            <Input id={`${id}-search`} type="search" value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by business type or service" disabled={saving}
              className="min-h-11 border-white/20 bg-black/40 pl-9 text-base text-white placeholder:text-white/50"
              aria-describedby={`${id}-results`} />
          </div>
          {query ? <Button type="button" variant="outline" disabled={saving} onClick={() => setQuery("")}
            className="min-h-11 border-white/20 bg-white/5 text-white">Clear</Button> : null}
        </div>
        <p id={`${id}-results`} role="status" className="text-sm text-white/75">
          {results.length} {results.length === 1 ? "template" : "templates"} shown
        </p>
      </div>

      <fieldset disabled={saving} className="min-w-0">
        <legend className="sr-only">Profile layout</legend>
        <div className="grid max-h-[min(50vh,30rem)] min-w-0 gap-3 overflow-y-auto p-1 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((template) => {
            const current = template.id === currentTemplate;
            const selected = template.id === selectedId;
            return (
              <label key={template.id} htmlFor={`${id}-${template.id}`}
                className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-orange-300 focus-within:ring-offset-2 focus-within:ring-offset-stone-950 ${
                  selected ? "border-ts-orange bg-ts-orange/15" : "border-white/20 bg-white/5 hover:border-white/40"
                } ${saving ? "cursor-wait opacity-60" : ""}`}>
                <input id={`${id}-${template.id}`} name={`${id}-layout`} type="radio" value={template.id}
                  checked={selected} onChange={() => setSelectedId(template.id)}
                  aria-describedby={`${id}-${template.id}-description`}
                  className="mt-1 h-4 w-4 shrink-0 accent-orange-500"
                  data-testid={`profile-manage-template-${template.id}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                    {template.label}
                    {current ? <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-white/90">
                      <Check aria-hidden="true" className="h-3 w-3" />Current
                    </span> : null}
                  </span>
                  <span id={`${id}-${template.id}-description`} className="mt-2 block break-words text-sm leading-relaxed text-white/75">
                    {template.description}
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-white/65">Best for: {template.bestFor}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {!results.length ? <div className="rounded-xl border border-dashed border-white/20 p-5 text-center">
        <p className="font-semibold text-white">No matching templates</p>
        <p className="mt-1 text-sm text-white/75">Try a trade name or clear the search to see every available layout.</p>
      </div> : null}

      <div className="flex flex-col gap-3 border-t border-white/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm leading-relaxed text-white/80" aria-live="polite">
          {hasUnsavedEdits ? <p>Save your profile edits before applying a different template.</p> :
            <p>{selected ? `Selected: ${selected.label}` : "Select a layout to continue."}</p>}
        </div>
        <Button type="submit" disabled={!canApply} className="min-h-11 shrink-0 bg-ts-orange text-white hover:bg-ts-orange-dark"
          data-testid="profile-manage-apply-template">
          {saving ? "Applying…" : "Apply template"}
        </Button>
      </div>
    </form>
  );
}
