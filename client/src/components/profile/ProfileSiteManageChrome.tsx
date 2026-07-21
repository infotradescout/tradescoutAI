import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { JW_STONE_INVENTORY_CATEGORIES } from "@/data/jwStoneInventory";
import {
  listSelectableProfileSiteTemplates,
  patchHeroBlock,
  readFeaturedStoneSlugs,
  readInventoryLeadImageBySlug,
  resolveSiteTemplateId,
  seedBlocksForTemplate,
  upsertFeaturedStoneSlugs,
  upsertInventoryLeadImage,
  upsertSiteTemplateBlock,
  type ProfileSiteTemplateGalleryId,
  type ProfileSiteTemplateId,
} from "@shared/profileSiteTemplates";

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

function readHeroFields(contentBlocks: unknown): { title: string; text: string } {
  if (!Array.isArray(contentBlocks)) return { title: "", text: "" };
  const hero = contentBlocks.find(
    (block) => block && typeof block === "object" && (block as any).type === "hero"
  ) as { data?: Record<string, unknown> } | undefined;
  const data = hero?.data && typeof hero.data === "object" ? hero.data : {};
  return {
    title: typeof data.title === "string" ? data.title : "",
    text:
      typeof data.text === "string"
        ? data.text
        : typeof data.body === "string"
          ? data.body
          : typeof data.description === "string"
            ? data.description
            : "",
  };
}

export default function ProfileSiteManageChrome({
  profileId,
  profileSlug,
  displayName,
  headline,
  contentBlocks,
  siteTemplate,
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
  const [bridging, setBridging] = useState(false);
  const hero = useMemo(() => readHeroFields(contentBlocks), [contentBlocks]);
  const [draftDisplayName, setDraftDisplayName] = useState(displayName);
  const [draftHeadline, setDraftHeadline] = useState(headline || "");
  const [draftHeroTitle, setDraftHeroTitle] = useState(hero.title);
  const [draftHeroText, setDraftHeroText] = useState(hero.text);
  const [draftFeatured, setDraftFeatured] = useState(() =>
    readFeaturedStoneSlugs(contentBlocks).join(", ")
  );
  const leadImageBySlug = useMemo(
    () => readInventoryLeadImageBySlug(contentBlocks),
    [contentBlocks]
  );

  const editorHref = `${platformBaseHref}/u/${encodeURIComponent(profileSlug)}/edit`;
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
    nextMeta?: { displayName?: string; headline?: string | null }
  ) => {
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/profiles/${profileId}`, {
        displayName: nextMeta?.displayName ?? draftDisplayName,
        headline: nextMeta?.headline !== undefined ? nextMeta.headline : draftHeadline || null,
        contentBlocks: nextBlocks,
      });
      toast({ title: "Profile updated" });
      onSaved();
    } catch (error: any) {
      toast({
        title: "Could not save",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveInline = async () => {
    let next = patchHeroBlock(contentBlocks, {
      title: draftHeroTitle,
      text: draftHeroText,
    });
    if (siteTemplate === "wholesaler") {
      const slugs = draftFeatured
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      next = upsertFeaturedStoneSlugs(next, slugs);
    }
    await persistBlocks(next, {
      displayName: draftDisplayName.trim() || displayName,
      headline: draftHeadline.trim() || null,
    });
  };

  const applyTemplate = async (templateId: ProfileSiteTemplateGalleryId, reset: boolean) => {
    const next = seedBlocksForTemplate(templateId, contentBlocks, {
      reset,
      displayName: draftDisplayName.trim() || displayName,
    });
    await persistBlocks(upsertSiteTemplateBlock(next, templateId));
    setShowTemplatePicker(false);
  };

  const setLeadImage = async (stoneSlug: string, imageUrl: string) => {
    await persistBlocks(upsertInventoryLeadImage(contentBlocks, stoneSlug, imageUrl));
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
      className="fixed inset-x-0 top-0 z-[80] border-b border-white/10 bg-stone-950 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
      data-testid="profile-site-manage-chrome"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-xs font-bold uppercase tracking-[0.16em] text-amber-300">
            Managing {displayName}
          </p>
          <Button
            type="button"
            size="sm"
            variant={editMode ? "default" : "outline"}
            className={
              editMode ? "bg-ts-orange hover:bg-ts-orange-dark" : "border-white/20 bg-white/5"
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
              className="border-white/20 bg-white/5"
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
            className="border-white/20 bg-white/5"
            onClick={() => setShowTemplatePicker((open) => !open)}
            data-testid="profile-manage-change-template"
          >
            Change template
          </Button>
          <Link href={editorHref}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/20 bg-white/5"
            >
              Full editor
            </Button>
          </Link>
          {customDomain && !isOnCustomDomain ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={bridging}
              className="border-white/20 bg-white/5"
              onClick={() => void openOnLiveDomain()}
              data-testid="profile-manage-open-live-domain"
            >
              {bridging ? "Opening…" : `Open on ${customDomain}`}
            </Button>
          ) : null}
        </div>

        {showTemplatePicker ? (
          <div className="grid max-h-[40vh] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                disabled={saving}
                onClick={() => {
                  const shouldReset =
                    template.id !== siteTemplate &&
                    window.confirm(
                      `Switch to “${template.label}”? Keep your gallery/inventory when possible.`
                    );
                  if (template.id !== siteTemplate && !shouldReset) return;
                  void applyTemplate(template.id, false);
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  template.id === siteTemplate
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
                            disabled={saving}
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

        {editMode ? (
          <div className="grid gap-3 rounded-xl border border-white/10 bg-black/30 p-3 md:grid-cols-2">
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
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-white/70">Hero text</Label>
              <Textarea
                value={draftHeroText}
                onChange={(event) => setDraftHeroText(event.target.value)}
                rows={2}
                className="border-white/15 bg-black/40 text-white"
              />
            </div>
            {siteTemplate === "wholesaler" ? (
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
          </div>
        ) : null}
      </div>
      {/* Spacer so fixed top chrome does not cover the hero */}
      <div className="pointer-events-none h-0" aria-hidden />
    </div>
  );
}
