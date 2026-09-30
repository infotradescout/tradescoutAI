import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { readProfileIdentity, sameProfileIdentity, type ProfileIdentity } from "@/lib/profileIdentity";
import { JW_STONE_INVENTORY_CATEGORIES } from "@/data/jwStoneInventory";
import ProfileContentVersionSummary from "./ProfileContentVersionSummary";
import {
  listSelectableProfileSiteTemplates,
  isProfileSiteTemplateId,
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

const JwStoneCurrentInventoryManager = lazy(() => import("./JwStoneCurrentInventoryManager"));

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

type EditSnapshot = {
  id: string;
  displayName: string;
  headline: string | null;
  contentBlocks: unknown[];
  contentBlocksRevision: number;
  siteTemplate: ProfileSiteTemplateId;
  identity: ProfileIdentity;
};

function readEditSnapshot(value: unknown, profileId: string): EditSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<EditSnapshot>;
  const identity = readProfileIdentity(value);
  if (!(candidate.id === profileId &&
    identity &&
    typeof candidate.displayName === "string" &&
    (typeof candidate.headline === "string" || candidate.headline === null) &&
    Array.isArray(candidate.contentBlocks) &&
    Number.isSafeInteger(candidate.contentBlocksRevision) &&
    isProfileSiteTemplateId(candidate.siteTemplate))) return null;
  return {
    id: candidate.id,
    displayName: candidate.displayName,
    headline: candidate.headline,
    contentBlocks: candidate.contentBlocks,
    contentBlocksRevision: candidate.contentBlocksRevision!,
    siteTemplate: candidate.siteTemplate,
    identity,
  };
}

function readHeroFields(contentBlocks: unknown): { title: string; text: string } {
  return readHeroEditorFields(contentBlocks);
}

export default function ProfileSiteManageChrome({
  profileId,
  profileSlug,
  displayName,
  headline,
  contentBlocks,
  editMode,
  platformBaseHref = "",
  customDomain = null,
  isOnCustomDomain = false,
  onSaved,
  onToggleEdit,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [bridging, setBridging] = useState(false);
  const [snapshot, setSnapshot] = useState<EditSnapshot | null>(null);
  const [draftMetaBase, setDraftMetaBase] = useState<EditSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState(false);
  const [snapshotLoadKey, setSnapshotLoadKey] = useState(0);
  const conflictAttempt = useRef(0);
  const [conflict, setConflict] = useState<{
    attemptId: number;
    reason: "content" | "target";
    pendingBlocks: unknown;
    pendingMeta?: { displayName?: string; headline?: string | null };
    latest: EditSnapshot | null;
    reviewing: boolean;
    reviewError: boolean;
  } | null>(null);
  const editableBlocks = snapshot?.contentBlocks ?? contentBlocks;
  const hero = useMemo(() => readHeroFields(editableBlocks), [editableBlocks]);
  const [draftDisplayName, setDraftDisplayName] = useState(displayName);
  const [draftHeadline, setDraftHeadline] = useState(headline || "");
  const [draftHeroTitle, setDraftHeroTitle] = useState(hero.title);
  const [draftHeroText, setDraftHeroText] = useState(hero.text);
  const [draftFeatured, setDraftFeatured] = useState(() =>
    readFeaturedStoneSlugs(contentBlocks).join(", ")
  );

  // Pair the editable blocks with their revision from the same private owner read.
  // Until this completes, no whole-array action is available.
  useEffect(() => {
    let current = true;
    setSnapshot(null);
    setDraftMetaBase(null);
    setSnapshotError(false);
    setConflict(null);
    void apiRequest("GET", `/api/profiles/${profileId}`)
      .then((response) => {
        if (!current) return;
        const loaded = readEditSnapshot(response, profileId);
        if (!loaded) {
          setSnapshotError(true);
          return;
        }
        const loadedHero = readHeroFields(loaded.contentBlocks);
        setDraftDisplayName(loaded.displayName);
        setDraftHeadline(loaded.headline || "");
        setDraftHeroTitle(loadedHero.title);
        setDraftHeroText(loadedHero.text);
        setDraftFeatured(readFeaturedStoneSlugs(loaded.contentBlocks).join(", "));
        setSnapshot(loaded);
        setDraftMetaBase(loaded);
      })
      .catch(() => {
        if (current) setSnapshotError(true);
      });
    return () => {
      current = false;
    };
  }, [profileId, snapshotLoadKey]);
  useEffect(() => {
    if (editMode || !snapshot) return;
    setDraftMetaBase(snapshot);
    const savedHero = readHeroFields(snapshot.contentBlocks);
    setDraftDisplayName(snapshot.displayName);
    setDraftHeadline(snapshot.headline || "");
    setDraftHeroTitle(savedHero.title);
    setDraftHeroText(savedHero.text);
    setDraftFeatured(readFeaturedStoneSlugs(snapshot.contentBlocks).join(", "));
  }, [editMode, snapshot]);
  const leadImageBySlug = useMemo(
    () => readInventoryLeadImageBySlug(editableBlocks),
    [editableBlocks]
  );

  const editorHref = qualifyPublicProfileItemDestination(
    `/u/${encodeURIComponent(profileSlug)}/edit`,
    platformBaseHref
  );
  const templates = listSelectableProfileSiteTemplates();
  const isJwStone = profileSlug === "jw-stone";
  const inventoryStones = useMemo(
    () =>
      isJwStone
        ? JW_STONE_INVENTORY_CATEGORIES.flatMap((category) =>
            category.stones.map((stone) => ({
              ...stone,
              category: category.category,
            }))
          )
        : [],
    [isJwStone]
  );

  const persistBlocks = async (
    nextBlocks: unknown,
    nextMeta?: { displayName?: string; headline?: string | null },
    reviewedSnapshot?: EditSnapshot
  ): Promise<boolean> => {
    const expectedContentBlocksRevision = reviewedSnapshot?.contentBlocksRevision ?? snapshot?.contentBlocksRevision;
    const expectedProfileIdentity = reviewedSnapshot?.identity ?? snapshot?.identity;
    if (!Number.isSafeInteger(expectedContentBlocksRevision) || !expectedProfileIdentity ||
        (conflict && (!reviewedSnapshot || conflict.reason === "target")) ||
        (reviewedSnapshot && (!snapshot || !sameProfileIdentity(reviewedSnapshot.identity, snapshot.identity)))) {
      return false;
    }
    setSaving(true);
    try {
      const changedMeta = {
        ...(nextMeta?.displayName !== undefined && nextMeta.displayName !== draftMetaBase?.displayName
          ? { displayName: nextMeta.displayName } : {}),
        ...(nextMeta?.headline !== undefined && nextMeta.headline !== draftMetaBase?.headline
          ? { headline: nextMeta.headline } : {}),
      };
      const response = await apiRequest("PUT", `/api/profiles/${profileId}`, {
        ...changedMeta,
        contentBlocks: nextBlocks,
        expectedContentBlocksRevision,
        expectedProfileIdentity,
      });
      const updated = readEditSnapshot(response, profileId);
      if (!updated) {
        setSnapshot(null);
        setSnapshotError(true);
        toast({ title: "Save needs confirmation", description: "Reload the current profile before another edit.", variant: "destructive" });
        return false;
      }
      setSnapshot(updated);
      if (nextMeta) {
        setDraftMetaBase(updated);
        setDraftDisplayName(updated.displayName);
        setDraftHeadline(updated.headline || "");
      }
      setConflict(null);
      toast({ title: "Profile updated" });
      onSaved();
      return true;
    } catch (error: any) {
      if (error?.status === 409 && error?.code === "PROFILE_CONTENT_BLOCKS_STALE") {
        setConflict({ attemptId: ++conflictAttempt.current, reason: "content", pendingBlocks: nextBlocks, pendingMeta: nextMeta, latest: null, reviewing: false, reviewError: false });
        return false;
      }
      if (error?.status === 409 && error?.code === "PROFILE_TARGET_CHANGED") {
        setConflict({ attemptId: ++conflictAttempt.current, reason: "target", pendingBlocks: nextBlocks, pendingMeta: nextMeta, latest: null, reviewing: false, reviewError: false });
        return false;
      }
      toast({
        title: "Could not save",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const reviewLatest = async () => {
    if (!conflict) return;
    const attemptId = conflict.attemptId;
    setConflict((current) => current && { ...current, reviewing: true, reviewError: false });
    try {
      const latest = readEditSnapshot(await apiRequest("GET", `/api/profiles/${profileId}`), profileId);
      if (!latest) throw new Error("Current profile revision unavailable");
      // Reviewing must never replace the draft or the original save base.
      setConflict((current) => current?.attemptId === attemptId ? {
        ...current,
        reason: current.reason === "target" || !snapshot || !sameProfileIdentity(snapshot.identity, latest.identity)
          ? "target" : "content",
        latest,
        reviewing: false,
      } : current);
    } catch {
      setConflict((current) => current?.attemptId === attemptId ? { ...current, reviewing: false, reviewError: true } : current);
    }
  };

  const saveInline = async () => {
    if (!snapshot) return;
    let next = patchHeroBlock(snapshot.contentBlocks, {
      title: draftHeroTitle,
      text: draftHeroText,
    });
    if (snapshot.siteTemplate === "wholesaler") {
      const slugs = draftFeatured
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      next = upsertFeaturedStoneSlugs(next, slugs);
    }
    await persistBlocks(next, {
      displayName: draftDisplayName.trim() || draftMetaBase?.displayName || snapshot.displayName,
      headline: draftHeadline === (draftMetaBase?.headline || "")
        ? draftMetaBase?.headline ?? null : draftHeadline.trim() || null,
    });
  };

  const applyTemplate = async (templateId: ProfileSiteTemplateGalleryId, reset: boolean) => {
    if (!snapshot) return;
    const next = seedBlocksForTemplate(templateId, snapshot.contentBlocks, {
      reset,
      displayName: draftDisplayName.trim() || snapshot.displayName,
    });
    if (await persistBlocks(upsertSiteTemplateBlock(next, templateId))) setShowTemplatePicker(false);
  };

  const setLeadImage = async (stoneSlug: string, imageUrl: string) => {
    if (!snapshot) return;
    await persistBlocks(upsertInventoryLeadImage(snapshot.contentBlocks, stoneSlug, imageUrl));
  };

  const openOnLiveDomain = async () => {
    if (!customDomain) return;
    setBridging(true);
    try {
      const { token } = await apiRequest("GET", `/api/profiles/${profileId}/manage-bridge-token`);
      const target = new URL(`https://${customDomain}/u/${encodeURIComponent(profileSlug)}`);
      target.searchParams.set("admin_token", token);
      target.searchParams.set("edit", "1");
      window.location.href = target.toString();
    } catch (error: any) {
      toast({
        title: "Could not open live domain",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
      setBridging(false);
    }
  };

  return (
    <div
      className="relative z-[80] border-b border-white/10 bg-stone-950 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
      data-testid="profile-site-manage-chrome"
    >
      <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-col justify-center gap-3 px-3 py-2 sm:px-6">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <p className="mr-auto shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300 sm:text-xs sm:tracking-[0.16em]">
            Managing {displayName}
          </p>
          <Button
            type="button"
            size="sm"
            variant={editMode ? "default" : "outline"}
            disabled={Boolean(conflict)}
            className={
              editMode
                ? "shrink-0 bg-ts-orange hover:bg-ts-orange-dark"
                : "shrink-0 border-white/20 bg-white/5"
            }
            onClick={() => onToggleEdit(!editMode)}
            data-testid="profile-manage-toggle-edit"
          >
            {editMode ? "Close edit" : "Edit profile"}
          </Button>
          {isJwStone ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-white/20 bg-white/5"
              aria-expanded={inventoryOpen}
              aria-controls="jw-physical-inventory"
              onClick={() => setInventoryOpen((open) => !open)}
            >
              {inventoryOpen ? "Close inventory" : "Current Inventory"}
            </Button>
          ) : null}
          {isJwStone ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-white/20 bg-white/5"
              onClick={() => {
                setLeadPickerOpen((open) => !open);
                if (!editMode) onToggleEdit(true);
              }}
              data-testid="profile-manage-lead-photos"
            >
              {leadPickerOpen ? "Hide lead photos" : "Pick lead photos"}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!snapshot || Boolean(conflict) || saving}
            className="shrink-0 border-white/20 bg-white/5"
            onClick={() => setShowTemplatePicker((open) => !open)}
            data-testid="profile-manage-change-template"
          >
            Change template
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 border-white/20 bg-white/5"
          >
            {requiresDocumentNavigation(editorHref) ? (
              <a href={editorHref}>Full editor</a>
            ) : (
              <Link href={editorHref}>Full editor</Link>
            )}
          </Button>
          {customDomain && !isOnCustomDomain ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={bridging}
              className="shrink-0 border-white/20 bg-white/5"
              onClick={() => void openOnLiveDomain()}
              data-testid="profile-manage-open-live-domain"
            >
              {bridging ? "Opening…" : `Open on ${customDomain}`}
            </Button>
          ) : null}
        </div>

        {!snapshot ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-amber-200">
            <span>
              {snapshotError
                ? "The current profile version could not be loaded. Editing is unavailable until it loads."
                : "Loading the current profile before editing…"}
            </span>
            {snapshotError ? (
              <Button type="button" variant="outline" onClick={() => setSnapshotLoadKey((key) => key + 1)}>
                Try loading again
              </Button>
            ) : null}
          </div>
        ) : null}
        {conflict ? (
          <div
            role="alert"
            data-testid="profile-manage-content-conflict"
            className="space-y-3 rounded-lg border border-amber-400/50 bg-amber-400/10 p-3 text-sm"
          >
            <p className="font-semibold">
              {conflict.reason === "target" ? "This profile changed where it is owned or shown." : "This profile changed before your draft could be saved."}
            </p>
            <p>
              {conflict.reason === "target"
                ? "The profile owner, business, role, address, or public status changed. Your draft remains on this page while it stays open. Reload the profile before saving to the new target."
                : "Another person or a background update may have changed it. Your unsaved draft remains on this page while it stays open. Review the current saved version, then choose whether to replace it with your draft or discard your draft and reload."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={conflict.reviewing || saving}
                onClick={() => void reviewLatest()}
              >
                {conflict.reviewing ? "Loading current version…" : "Review current saved version"}
              </Button>
              <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                Discard my draft and reload
              </Button>
            </div>
            {conflict.reviewError ? (
              <p>Could not load the current saved version. Your draft remains here; try reviewing again.</p>
            ) : null}
            {conflict.latest ? (
              <div className="space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <ProfileContentVersionSummary
                    heading="Current saved version"
                    displayName={conflict.latest.displayName}
                    headline={conflict.latest.headline}
                    contentBlocks={conflict.latest.contentBlocks}
                  />
                  <ProfileContentVersionSummary
                    heading="Your unsaved draft"
                    displayName={conflict.pendingMeta?.displayName ?? draftDisplayName}
                    headline={conflict.pendingMeta?.headline ?? draftHeadline}
                    contentBlocks={conflict.pendingBlocks}
                  />
                </div>
                <details className="rounded-md border border-white/20 p-2">
                  <summary className="cursor-pointer">Show full page details</summary>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <p className="font-semibold">Current saved sections</p>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
                        {JSON.stringify(conflict.latest.contentBlocks, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="font-semibold">Your unsaved sections</p>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
                        {JSON.stringify(conflict.pendingBlocks, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
                {conflict.reason === "content" ? (
                  <>
                    <p>Retry overwrites the current saved page sections with your draft. It does not merge the two versions.</p>
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={() => void persistBlocks(conflict.pendingBlocks, conflict.pendingMeta, conflict.latest!)}
                      className="bg-ts-orange hover:bg-ts-orange-dark"
                    >
                      Retry saving my draft
                    </Button>
                  </>
                ) : (
                  <p>This draft cannot be retried against a changed profile target. Reload before saving.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {showTemplatePicker ? (
          <div className="grid max-h-[40vh] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                disabled={saving || !snapshot || Boolean(conflict)}
                onClick={() => {
                  const shouldReset =
                    template.id !== snapshot?.siteTemplate &&
                    window.confirm(
                      `Switch to “${template.label}”? Keep your gallery/inventory when possible.`
                    );
                  if (template.id !== snapshot?.siteTemplate && !shouldReset) return;
                  void applyTemplate(template.id, false);
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  template.id === snapshot?.siteTemplate
                    ? "border-ts-orange bg-ts-orange/15"
                    : "border-white/15 bg-white/5 hover:border-white/30"
                }`}
                data-testid={`profile-manage-template-${template.id}`}
              >
                <p className="text-sm font-bold">{template.label}</p>
                <p className="mt-1 text-xs text-white/65">{template.description}</p>
              </button>
            ))}
          </div>
        ) : null}

        {inventoryOpen && isJwStone ? (
          <div id="jw-physical-inventory">
            <Suspense fallback={<p role="status">Loading current inventory…</p>}>
              <JwStoneCurrentInventoryManager
                key={profileSlug}
                open
                profileSlug={profileSlug}
                onClose={() => setInventoryOpen(false)}
              />
            </Suspense>
          </div>
        ) : null}

        {leadPickerOpen && isJwStone ? (
          <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3">
            <p className="text-sm text-white/80">
              Tap the photo that should show first for each stone. Saves immediately.
            </p>
            {inventoryStones
              .filter((stone) => stone.images.length > 1)
              .slice(0, 40)
              .map((stone) => {
                const activeLead = leadImageBySlug[stone.slug] || stone.images[0];
                return (
                  <div
                    key={stone.slug}
                    className="space-y-2 border-b border-white/10 pb-3 last:border-0"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">{stone.name}</p>
                      <p className="text-[11px] uppercase tracking-wide text-white/50">
                        {stone.category}
                      </p>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {stone.images.map((image) => {
                        const selected = image === activeLead;
                        return (
                          <button
                            key={image}
                            type="button"
                            disabled={saving || !snapshot || Boolean(conflict)}
                            onClick={() => void setLeadImage(stone.slug, image)}
                            className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-md border-2 ${
                              selected
                                ? "border-amber-400 ring-2 ring-amber-400/40"
                                : "border-white/20 opacity-80 hover:opacity-100"
                            }`}
                            title="Use as lead photo"
                            data-testid={`profile-lead-${stone.slug}`}
                          >
                            <img src={image} alt="" className="h-full w-full object-cover" />
                            {selected ? (
                              <span className="absolute inset-x-0 bottom-0 bg-amber-400/90 px-1 text-[9px] font-bold text-stone-950">
                                LEAD
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : null}

        {editMode && snapshot ? (
          <fieldset disabled={Boolean(conflict) || saving} className="grid gap-3 rounded-xl border border-white/10 bg-black/30 p-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-white/70">Display name</Label>
              <Input
                value={draftDisplayName}
                onChange={(event) => setDraftDisplayName(event.target.value)}
                className="border-white/15 bg-black/40 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-white/70">Headline</Label>
              <Input
                value={draftHeadline}
                onChange={(event) => setDraftHeadline(event.target.value)}
                className="border-white/15 bg-black/40 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-white/70">Hero title</Label>
              <Input
                value={draftHeroTitle}
                onChange={(event) => setDraftHeroTitle(event.target.value)}
                className="border-white/15 bg-black/40 text-white"
                data-testid="profile-manage-hero-title"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-white/70">Hero text</Label>
              <Textarea
                value={draftHeroText}
                onChange={(event) => setDraftHeroText(event.target.value)}
                rows={2}
                className="border-white/15 bg-black/40 text-white"
                data-testid="profile-manage-hero-text"
              />
            </div>
            {snapshot.siteTemplate === "wholesaler" ? (
              <div className="space-y-1 md:col-span-2">
                <Label className="text-white/70">Featured inventory slugs (comma-separated)</Label>
                <Input
                  value={draftFeatured}
                  onChange={(event) => setDraftFeatured(event.target.value)}
                  placeholder="taj-mahal, rhino-white, cristallo"
                  className="border-white/15 bg-black/40 text-white"
                />
              </div>
            ) : null}
            <div className="md:col-span-2 flex justify-end">
              <Button
                type="button"
                disabled={saving}
                onClick={() => void saveInline()}
                className="bg-ts-orange hover:bg-ts-orange-dark"
                data-testid="profile-manage-save-inline"
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </fieldset>
        ) : null}
      </div>
    </div>
  );
}
