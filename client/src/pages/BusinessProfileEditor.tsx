import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

type OwnedProfile = {
  id: string;
  slug?: string | null;
  status?: "draft" | "published" | null;
};

function selectCanonicalOwnedProfile(profiles: OwnedProfile[], activeProfileId: unknown) {
  const activeId = String(activeProfileId || "").trim();
  return (
    profiles.find((profile) => activeId && String(profile.id) === activeId && profile.slug) ||
    profiles.find((profile) => profile.status === "published" && profile.slug) ||
    profiles.find((profile) => profile.slug) ||
    null
  );
}

/**
 * Compatibility-only handoff for old /business/:slug/edit links.
 *
 * The legacy editor previously wrote a second business-profile model. All
 * owner editing now belongs to the canonical /u/:slug/edit profile editor.
 */
export default function BusinessProfileEditor() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: profiles = [], isLoading } = useQuery<OwnedProfile[]>({
    queryKey: ["/api/profiles"],
    queryFn: async () => {
      const result = await apiRequest("GET", "/api/profiles");
      return Array.isArray(result) ? result : [];
    },
  });

  const canonicalProfile = selectCanonicalOwnedProfile(profiles, (user as any)?.activeProfileId);

  useEffect(() => {
    if (isLoading) return;
    const destination = canonicalProfile?.slug
      ? `/u/${encodeURIComponent(canonicalProfile.slug)}/edit`
      : "/profile";
    navigate(destination, { replace: true });
  }, [canonicalProfile?.slug, isLoading, navigate]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-white/70">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Opening your profile editor…
    </div>
  );
}
