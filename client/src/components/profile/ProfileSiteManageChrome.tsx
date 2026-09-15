import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  qualifyPublicProfileItemDestination,
  requiresDocumentNavigation,
} from "@/lib/publicProfileItemDestination";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { JW_STONE_INVENTORY_CATEGORIES } from "@/data/jwStoneInventory";
import {
  patchHeroBlock,
  readFeaturedStoneSlugs,
  readHeroEditorFields,
  readInventoryLeadImageBySlug,
  seedBlocksForTemplate,
  upsertFeaturedStoneSlugs,
  upsertInventoryLeadImage,
  upsertSiteTemplateBlock,
  type ProfileSiteTemplateGalleryId,
  type ProfileSiteTemplateId,
} from "@shared/profileSiteTemplates";
import ProfileTemplatePicker from "./ProfileTemplatePicker";

const JwStoneCurrentInventoryManager = lazy(() => import("./JwStoneCurrentInventoryManager"));
const toolbarButtonClass =
  "min-h-11 h-auto max-w-full whitespace-normal break-words border-white/20 bg-white/5 px-3 py-2 text-white hover:bg-white/10";
const fieldClass = "min-h-11 border-white/20 bg-black/40 text-base text-white";

type Props = {
  profileId: string;
  profileSlug: string;
  displayName: string;
  headline: string | null;
  contentBlocks: unknown;
  siteTemplate: ProfileSiteTemplateId;
  editMode: boolean;
  platformBaseHref?: string;
  customDomain?: string | null;
  isOnCustomDomain?: boolean;
  onSaved: () => void;
  onToggleEdit: (next: boolean) => void;
};

export default function ProfileSiteManageChrome({
  profileId, profileSlug, displayName, headline, contentBlocks, siteTemplate, editMode,
  platformBaseHref = "", customDomain = null, isOnCustomDomain = false, onSaved, onToggleEdit,
}: Props) {
  const { toast } = useToast();
  const id = useId();
  const savingRef = useRef(false);
  const templateToggleRef = useRef<HTMLButtonElement>(null);
  const templatePickerWasOpen = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [bridging, setBridging] = useState(false);
  const hero = useMemo(() => readHeroEditorFields(contentBlocks), [contentBlocks]);
  const [draftDisplayName, setDraftDisplayName] = useState(displayName);
  const [draftHeadline, setDraftHeadline] = useState(headline || "");
  const [draftHeroTitle, setDraftHeroTitle] = useState(hero.title);
  const [draftHeroText, setDraftHeroText] = useState(hero.text);
  const [draftFeatured, setDraftFeatured] = useState(() => readFeaturedStoneSlugs(contentBlocks).join(", "));

  // A payload refresh must never erase an in-progress edit.
  useEffect(() => {
    if (editMode) return;
    setDraftDisplayName(displayName);
    setDraftHeadline(headline || "");
    setDraftHeroTitle(hero.title);
    setDraftHeroText(hero.text);
    setDraftFeatured(readFeaturedStoneSlugs(contentBlocks).join(", "));
  }, [contentBlocks, displayName, editMode, headline, hero.text, hero.title]);

  const hasUnsavedEdits = editMode && (
    draftDisplayName !== displayName || draftHeadline !== (headline || "") ||
    draftHeroTitle !== hero.title || draftHeroText !== hero.text ||
    (siteTemplate === "wholesaler" && draftFeatured !== readFeaturedStoneSlugs(contentBlocks).join(", "))
  );
  useEffect(() => {
    if (!hasUnsavedEdits && !saving) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedEdits, saving]);

  useEffect(() => {
    if (templatePickerWasOpen.current && !showTemplatePicker) templateToggleRef.current?.focus();
    templatePickerWasOpen.current = showTemplatePicker;
  }, [showTemplatePicker]);
  const closeTemplates = () => setShowTemplatePicker(false);
  const confirmLeavingEditor = () => !hasUnsavedEdits || window.confirm("Leave without saving your profile edits?");
  const guardEditorNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (savingRef.current || !confirmLeavingEditor()) event.preventDefault();
  };
  const leadImageBySlug = useMemo(() => readInventoryLeadImageBySlug(contentBlocks), [contentBlocks]);
  const editorHref = qualifyPublicProfileItemDestination(`/u/${encodeURIComponent(profileSlug)}/edit`, platformBaseHref);
  const isJwStone = profileSlug === "jw-stone";
  const inventoryStones = useMemo(() => isJwStone
    ? JW_STONE_INVENTORY_CATEGORIES.flatMap((category) => category.stones.map((stone) => ({ ...stone, category: category.category })))
    : [], [isJwStone]);

  const persistBlocks = async (
    nextBlocks: unknown,
    nextMeta?: { displayName?: string; headline?: string | null }
  ): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await apiRequest("PUT", `/api/profiles/${profileId}`, {
        displayName: nextMeta?.displayName ?? draftDisplayName,
        headline: nextMeta?.headline !== undefined ? nextMeta.headline : draftHeadline || null,
        contentBlocks: nextBlocks,
      });
      setSaved(true);
      toast({ title: "Profile updated" });
      onSaved();
      return true;
    } catch (error: unknown) {
      const message = formatUserFacingErrorMessage(error, "Your changes could not be confirmed. Please try again.");
      setSaveError(message);
      toast({ title: "Could not save", description: message, variant: "destructive" });
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveInline = async () => {
    let next = patchHeroBlock(contentBlocks, { title: draftHeroTitle, text: draftHeroText });
    if (siteTemplate === "wholesaler") {
      next = upsertFeaturedStoneSlugs(next, draftFeatured.split(",").map((value) => value.trim()).filter(Boolean));
    }
    const nextDisplayName = draftDisplayName.trim() || displayName;
    const nextHeadline = draftHeadline.trim() || null;
    if (await persistBlocks(next, { displayName: nextDisplayName, headline: nextHeadline })) {
      setDraftDisplayName(nextDisplayName);
      setDraftHeadline(nextHeadline || "");
      if (siteTemplate === "wholesaler") setDraftFeatured(readFeaturedStoneSlugs(next).join(", "));
    }
  };

  const applyTemplate = async (templateId: ProfileSiteTemplateGalleryId): Promise<boolean> => {
    if (hasUnsavedEdits || savingRef.current || templateId === siteTemplate) return false;
    const next = seedBlocksForTemplate(templateId, contentBlocks, {
      reset: false,
      displayName: draftDisplayName.trim() || displayName,
    });
    const success = await persistBlocks(upsertSiteTemplateBlock(next, templateId));
    if (success) closeTemplates();
    return success;
  };

  const setLeadImage = async (stoneSlug: string, imageUrl: string) => {
    await persistBlocks(upsertInventoryLeadImage(contentBlocks, stoneSlug, imageUrl));
  };

  const toggleEdit = () => {
    if (savingRef.current) return;
    if (hasUnsavedEdits && !window.confirm("Discard your unsaved profile edits and close the editor?")) return;
    setSaveError(null);
    setSaved(false);
    onToggleEdit(!editMode);
  };

  const openOnLiveDomain = async () => {
    if (!customDomain || savingRef.current || !confirmLeavingEditor()) return;
    setBridging(true);
    try {
      const { token } = await apiRequest("GET", `/api/profiles/${profileId}/manage-bridge-token`);
      const target = new URL(`https://${customDomain}/u/${encodeURIComponent(profileSlug)}`);
      target.searchParams.set("admin_token", token);
      target.searchParams.set("edit", "1");
      window.location.href = target.toString();
    } catch (error: unknown) {
      toast({ title: "Could not open live domain", description: formatUserFacingErrorMessage(error, "Please try again."), variant: "destructive" });
      setBridging(false);
    }
  };

  return (
    <div className="relative z-[80] border-b border-white/10 bg-stone-950 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
      data-testid="profile-site-manage-chrome">
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 break-words text-sm font-semibold text-amber-300">Managing {displayName}</p>
          <p role="status" className="text-sm text-white/80">
            {saving ? "Saving changes…" : hasUnsavedEdits ? "Unsaved changes" : saved ? "Changes saved" : "Owner controls"}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Profile management">
          <Button type="button" size="sm" variant={editMode ? "default" : "outline"}
            className={editMode ? "min-h-11 bg-ts-orange text-white hover:bg-ts-orange-dark" : toolbarButtonClass}
            disabled={saving} onClick={toggleEdit} aria-expanded={editMode} aria-controls={`${id}-editor`}
            data-testid="profile-manage-toggle-edit">{editMode ? "Close edit" : "Edit profile"}</Button>
          {isJwStone ? <Button type="button" size="sm" variant="outline" className={toolbarButtonClass}
            aria-expanded={inventoryOpen} aria-controls="jw-physical-inventory" onClick={() => setInventoryOpen((open) => !open)}>
            {inventoryOpen ? "Close inventory" : "Current Inventory"}
          </Button> : null}
          {isJwStone ? <Button type="button" size="sm" variant="outline" className={toolbarButtonClass}
            disabled={saving} aria-expanded={leadPickerOpen} aria-controls={`${id}-lead-photos`}
            onClick={() => { setLeadPickerOpen((open) => !open); if (!editMode) onToggleEdit(true); }}
            data-testid="profile-manage-lead-photos">{leadPickerOpen ? "Hide lead photos" : "Pick lead photos"}</Button> : null}
          <Button ref={templateToggleRef} type="button" size="sm" variant="outline" className={toolbarButtonClass} disabled={saving}
            onClick={() => setShowTemplatePicker((open) => !open)} aria-expanded={showTemplatePicker} aria-controls={`${id}-templates`}
            data-testid="profile-manage-change-template">{showTemplatePicker ? "Hide templates" : "Change template"}</Button>
          <Button asChild size="sm" variant="outline" className={toolbarButtonClass}>
            {requiresDocumentNavigation(editorHref) ? <a href={editorHref} onClick={guardEditorNavigation}>Full editor</a> : <Link href={editorHref} onClick={guardEditorNavigation}>Full editor</Link>}
          </Button>
          {customDomain && !isOnCustomDomain ? <Button type="button" size="sm" variant="outline" disabled={bridging || saving}
            className={toolbarButtonClass} onClick={() => void openOnLiveDomain()} data-testid="profile-manage-open-live-domain">
            {bridging ? "Opening…" : `Open on ${customDomain}`}
          </Button> : null}
        </div>
        {saveError ? <div role="alert" className="rounded-xl border border-red-400/40 bg-red-950/40 p-3 text-sm leading-relaxed text-red-100">
          <p className="font-semibold">Could not save changes</p><p className="mt-1">{saveError}</p>
        </div> : null}
        {showTemplatePicker ? <div id={`${id}-templates`}>
          <ProfileTemplatePicker key={`${profileId}:${siteTemplate}`} currentTemplate={siteTemplate} saving={saving}
            hasUnsavedEdits={hasUnsavedEdits} onApply={applyTemplate} onClose={closeTemplates} />
        </div> : null}

        {inventoryOpen && isJwStone ? <div id="jw-physical-inventory">
          <Suspense fallback={<p role="status">Loading current inventory…</p>}>
            <JwStoneCurrentInventoryManager key={profileSlug} open profileSlug={profileSlug} onClose={() => setInventoryOpen(false)} />
          </Suspense>
        </div> : null}

        {leadPickerOpen && isJwStone ? <div id={`${id}-lead-photos`} className="max-h-[50vh] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3">
          <p className="text-sm text-white/80">Tap the photo that should show first for each stone. Saves immediately.</p>
          {inventoryStones.filter((stone) => stone.images.length > 1).slice(0, 40).map((stone) => {
            const activeLead = leadImageBySlug[stone.slug] || stone.images[0];
            return <div key={stone.slug} className="space-y-2 border-b border-white/10 pb-3 last:border-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{stone.name}</p>
                <p className="text-xs uppercase tracking-wide text-white/70">{stone.category}</p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {stone.images.map((image, index) => {
                  const selected = image === activeLead;
                  return <button key={image} type="button" disabled={saving} onClick={() => void setLeadImage(stone.slug, image)}
                    className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-md border-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${selected ? "border-amber-400 ring-2 ring-amber-400/40" : "border-white/20 opacity-80 hover:opacity-100"}`}
                    title="Use as lead photo" aria-label={`Use photo ${index + 1} as the lead for ${stone.name}`} aria-pressed={selected}
                    data-testid={`profile-lead-${stone.slug}`}>
                    <img src={image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    {selected ? <span className="absolute inset-x-0 bottom-0 bg-amber-400/90 px-1 text-[9px] font-bold text-stone-950">LEAD</span> : null}
                  </button>;
                })}
              </div>
            </div>;
          })}
        </div> : null}

        {editMode ? <form id={`${id}-editor`} aria-label="Edit profile details" aria-busy={saving}
          onSubmit={(event) => { event.preventDefault(); void saveInline(); }}
          className="grid min-w-0 gap-4 rounded-2xl border border-white/15 bg-black/30 p-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-name`} className="text-white/90">Display name</Label>
            <Input id={`${id}-name`} value={draftDisplayName} disabled={saving} onChange={(event) => setDraftDisplayName(event.target.value)} className={fieldClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-headline`} className="text-white/90">Headline</Label>
            <Input id={`${id}-headline`} value={draftHeadline} disabled={saving} onChange={(event) => setDraftHeadline(event.target.value)} className={fieldClass} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${id}-hero-title`} className="text-white/90">Hero title</Label>
            <Input id={`${id}-hero-title`} value={draftHeroTitle} disabled={saving} onChange={(event) => setDraftHeroTitle(event.target.value)}
              className={fieldClass} data-testid="profile-manage-hero-title" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${id}-hero-text`} className="text-white/90">Hero text</Label>
            <Textarea id={`${id}-hero-text`} value={draftHeroText} disabled={saving} onChange={(event) => setDraftHeroText(event.target.value)}
              rows={3} className={fieldClass} data-testid="profile-manage-hero-text" />
          </div>
          {siteTemplate === "wholesaler" ? <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${id}-featured`} className="text-white/90">Featured inventory slugs (comma-separated)</Label>
            <Input id={`${id}-featured`} value={draftFeatured} disabled={saving} onChange={(event) => setDraftFeatured(event.target.value)}
              placeholder="taj-mahal, rhino-white, cristallo" className={fieldClass} />
          </div> : null}
          <div className="flex flex-col gap-3 border-t border-white/15 pt-4 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
            <p className="text-sm text-white/75">Changes appear on your public profile after saving.</p>
            <Button type="submit" disabled={saving} className="min-h-11 shrink-0 bg-ts-orange text-white hover:bg-ts-orange-dark"
              data-testid="profile-manage-save-inline">{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </form> : null}
      </div>
    </div>
  );
}
