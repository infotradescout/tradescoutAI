import type { ReactNode } from "react";
import JWStoneMarketplace from "@/features/jw-stone/JWStoneMarketplace";
import { JwStoneProfileProvider } from "@/features/jw-stone/JwStoneProfileContext";
import { JwStoneProfileSeo } from "@/features/jw-stone/JwStoneProfileSeo";

export default function JwStoneMarketplaceProfile({
  profileActions,
  profileCanonicalUrl,
}: {
  profileActions?: ReactNode;
  profileCanonicalUrl: string;
}) {
  return (
    <JwStoneProfileProvider
      profileActions={profileActions}
      profileCanonicalUrl={profileCanonicalUrl}
    >
      <JWStoneMarketplace />
      <JwStoneProfileSeo canonical={profileCanonicalUrl} />
    </JwStoneProfileProvider>
  );
}
