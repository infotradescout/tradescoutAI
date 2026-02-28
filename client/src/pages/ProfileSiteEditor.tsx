import { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

type OwnedProfile = {
  id: string;
  slug: string;
  displayName: string;
  roleContext: string;
  status: "draft" | "published";
};

type ProfileDetail = OwnedProfile & {
  headline: string | null;
  businessId: string | null;
  contentBlocks: any;
  ctaConfig: any;
  seoMeta: any;
};

export default function ProfileSiteEditor() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [matchU, paramsU] = useRoute("/u/:slug/edit");
  const [, paramsP] = useRoute("/p/:slug/edit");
  const [, setLocation] = useLocation();

  const slug = (paramsU?.slug || paramsP?.slug || "").trim();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileDetail | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [contentBlocksText, setContentBlocksText] = useState("[]");
  const [ctaConfigText, setCtaConfigText] = useState("{}");
  const [seoMetaText, setSeoMetaText] = useState("{}");
  const [customDomain, setCustomDomain] = useState("");

  const profileVisibility = user?.preferences?.profileVisibility || "private";

  useEffect(() => {
    const load = async () => {
      if (!slug) return;

      try {
        const listRes = await apiRequest("GET", "/api/profiles");
        const list = (await listRes.json()) as OwnedProfile[];
        const found = list.find((p) => p.slug === slug);
        if (!found) {
          setProfile(null);
          return;
        }

        const detailRes = await apiRequest("GET", `/api/profiles/${found.id}`);
        const detail = (await detailRes.json()) as ProfileDetail;
        setProfile(detail);

        setDisplayName(detail.displayName || "");
        setHeadline(detail.headline || "");
        setContentBlocksText(JSON.stringify(detail.contentBlocks ?? [], null, 2));
        setCtaConfigText(JSON.stringify(detail.ctaConfig ?? {}, null, 2));
        setSeoMetaText(JSON.stringify(detail.seoMeta ?? {}, null, 2));
        setCustomDomain(String(detail.seoMeta?.customDomain || ""));
      } catch (error: any) {
        console.error("Error loading profile:", error);
        toast({
          title: "Could not load profile",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug, toast]);

  useEffect(() => {
    if (matchU || !slug) return;
    setLocation(`/u/${encodeURIComponent(slug)}/edit`);
  }, [matchU, setLocation, slug]);

  const parsedPayload = useMemo(() => {
    try {
      return {
        contentBlocks: JSON.parse(contentBlocksText || "[]"),
        ctaConfig: JSON.parse(ctaConfigText || "{}"),
        seoMeta: JSON.parse(seoMetaText || "{}"),
      };
    } catch {
      return null;
    }
  }, [contentBlocksText, ctaConfigText, seoMetaText]);

  const save = async () => {
    if (!profile) return;
    if (!parsedPayload) {
      toast({
        title: "Invalid JSON",
        description: "Fix contentBlocks / ctaConfig / seoMeta JSON before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      const allowedBlockTypes = new Set([
        "hero",
        "about",
        "services",
        "gallery",
        "faq",
        "reviews",
        "cta",
        "custom",
      ]);

      const normalizeContentBlocks = Array.isArray(parsedPayload.contentBlocks)
        ? parsedPayload.contentBlocks
            .filter((block: any) => block && typeof block === "object")
            .map((block: any) => ({
              type: allowedBlockTypes.has(String(block.type || "")) ? String(block.type) : "custom",
              data:
                block.data && typeof block.data === "object" && !Array.isArray(block.data)
                  ? block.data
                  : {},
            }))
        : [];

      const normalizeCta = (cta: any) => {
        if (!cta || typeof cta !== "object") return undefined;
        const label = typeof cta.label === "string" ? cta.label.trim() : "";
        const kind = typeof cta.kind === "string" ? cta.kind.trim() : "";
        const value = typeof cta.value === "string" ? cta.value.trim() : "";
        if (!label || !kind || !value) return undefined;
        return { label, kind, value };
      };

      const normalizedCtaConfig = {
        ...(normalizeCta((parsedPayload.ctaConfig as any)?.primary)
          ? { primary: normalizeCta((parsedPayload.ctaConfig as any)?.primary) }
          : {}),
        ...(normalizeCta((parsedPayload.ctaConfig as any)?.secondary)
          ? { secondary: normalizeCta((parsedPayload.ctaConfig as any)?.secondary) }
          : {}),
      };

      const seoMetaFromText =
        parsedPayload.seoMeta && typeof parsedPayload.seoMeta === "object"
          ? { ...(parsedPayload.seoMeta as Record<string, unknown>) }
          : {};
      const normalizedDomain = customDomain.trim().toLowerCase();
      if (normalizedDomain) {
        seoMetaFromText.customDomain = normalizedDomain;
      } else {
        delete (seoMetaFromText as any).customDomain;
      }

      const normalizedSeoMeta = {
        ...(typeof (seoMetaFromText as any).title === "string"
          ? { title: String((seoMetaFromText as any).title) }
          : {}),
        ...(typeof (seoMetaFromText as any).description === "string"
          ? { description: String((seoMetaFromText as any).description) }
          : {}),
        ...(typeof (seoMetaFromText as any).imageUrl === "string"
          ? { imageUrl: String((seoMetaFromText as any).imageUrl) }
          : {}),
        ...(typeof (seoMetaFromText as any).customDomain === "string"
          ? { customDomain: String((seoMetaFromText as any).customDomain) }
          : {}),
      };

      const res = await apiRequest("PUT", `/api/profiles/${profile.id}`, {
        displayName,
        headline: headline || null,
        contentBlocks: normalizeContentBlocks,
        ctaConfig: normalizedCtaConfig,
        seoMeta: normalizedSeoMeta,
      });
      const updated = (await res.json()) as ProfileDetail;
      setProfile(updated);

      toast({ title: "Saved", description: "Your profile has been updated." });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const publish = async () => {
    if (!profile) return;
    try {
      const res = await apiRequest("PUT", `/api/profiles/${profile.id}/publish`);
      const updated = (await res.json()) as ProfileDetail;
      setProfile(updated);
      toast({
        title: "Published",
        description: "Your profile is now public (if your visibility is public).",
      });
    } catch (error: any) {
      toast({
        title: "Publish failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const unpublish = async () => {
    if (!profile) return;
    try {
      const res = await apiRequest("PUT", `/api/profiles/${profile.id}/unpublish`);
      const updated = (await res.json()) as ProfileDetail;
      setProfile(updated);
      toast({ title: "Unpublished", description: "Your profile is now private (draft)." });
    } catch (error: any) {
      toast({
        title: "Unpublish failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const setVisibility = async (next: "public" | "private") => {
    try {
      const firstRes = await apiRequest("PATCH", "/api/users/profile-visibility", {
        profileVisibility: next,
      });
      const firstPayload = await firstRes.json().catch(() => ({}) as any);

      if (firstPayload?.allowProceedUnverified && next === "public") {
        const proceed = window.confirm(
          "Verification is recommended before publishing. Make profile public now anyway?"
        );
        if (!proceed) {
          toast({ title: "Verification recommended", description: "Visibility not changed." });
          return;
        }

        await apiRequest("PATCH", "/api/users/profile-visibility", {
          profileVisibility: next,
          proceedUnverified: true,
        });
      }

      toast({ title: "Updated", description: `Profile visibility set to ${next}.` });
      setLocation(`/u/${slug}/edit`);
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className=" flex items-center justify-center">
        <div className="ts-surface px-4 py-6 md:px-10 md:py-8 text-white">Loading editor…</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className=" flex items-center justify-center px-4">
        <Card className="bg-tsCard border-white/10 w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-white">Profile not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-white/70">You may not have access to this profile.</p>
            <Link href="/scout">
              <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className=" py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <Card className="bg-tsCard border-white/10">
          <CardHeader className="space-y-1">
            <CardTitle className="text-white">Edit Profile Site</CardTitle>
            <p className="text-white/70 text-sm">Draft until you publish.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Link href={`/u/${profile.slug}`}>
                <Button variant="outline" className="border-white/10 text-white/70">
                  View public page
                </Button>
              </Link>
              <Button onClick={save} className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                Save
              </Button>
              {profile.status === "published" ? (
                <Button
                  onClick={unpublish}
                  variant="outline"
                  className="border-white/10 text-white/70"
                >
                  Unpublish
                </Button>
              ) : (
                <Button
                  onClick={publish}
                  variant="outline"
                  className="border-white/10 text-white/70"
                >
                  Publish
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Headline</Label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="One-liner"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Content blocks (JSON)</Label>
              <Textarea
                value={contentBlocksText}
                onChange={(e) => setContentBlocksText(e.target.value)}
                rows={10}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">CTA config (JSON)</Label>
              <Textarea
                value={ctaConfigText}
                onChange={(e) => setCtaConfigText(e.target.value)}
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">SEO meta (JSON)</Label>
              <Textarea
                value={seoMetaText}
                onChange={(e) => setSeoMetaText(e.target.value)}
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Custom domain (optional)</Label>
              <Input
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="profile.yourdomain.com"
              />
              <p className="text-white/60 text-xs">
                When configured in DNS, this domain will resolve to this public profile.
              </p>
            </div>

            <div className="pt-2 border-t border-white/10">
              <p className="text-white/70 text-sm mb-2">
                Visibility setting: <span className="text-white">{profileVisibility}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="border-white/10 text-white/70"
                  onClick={() => setVisibility("public")}
                >
                  Make link public
                </Button>
                <Button
                  variant="outline"
                  className="border-white/10 text-white/70"
                  onClick={() => setVisibility("private")}
                >
                  Make link private
                </Button>
              </div>
              <p className="text-white/60 text-xs mt-2">
                Note: your profile must be published AND visibility must be public for guests to see
                it.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
