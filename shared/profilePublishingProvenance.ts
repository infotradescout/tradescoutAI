export const TRADESCOUT_PUBLISHER_ID = "https://www.thetradescout.com/#organization";
export const TRADESCOUT_PUBLISHER_URL = "https://www.thetradescout.com/";

type JsonLdNode = Record<string, unknown>;

type PublicProfilePublishingProvenanceOptions = {
  structuredData: JsonLdNode;
  pageUrl: string;
  mainEntityId: string;
  ownerIdentityId: string;
  pageType?: "ProfilePage" | "WebPage";
};

function absoluteHttpUrl(value: unknown): string | null {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function pageNodeId(pageUrl: string): string {
  const parsed = new URL(pageUrl);
  parsed.hash = "webpage";
  return parsed.toString();
}

function jsonLdGraph(structuredData: JsonLdNode): JsonLdNode[] {
  if (Array.isArray(structuredData["@graph"])) {
    return (structuredData["@graph"] as unknown[]).filter(
      (node): node is JsonLdNode =>
        Boolean(node) && typeof node === "object" && !Array.isArray(node)
    );
  }

  const node = Object.fromEntries(
    Object.entries(structuredData).filter(([key]) => key !== "@context")
  );
  return Object.keys(node).length > 0 ? [node] : [];
}

/**
 * Adds publishing-platform provenance without changing who owns the profile,
 * item, image, or collection. The public page points to its actual owner/item
 * through mainEntity; TradeScout is identified separately as publisher and
 * technical platform provider.
 */
export function withTradeScoutPublishingProvenance(
  options: PublicProfilePublishingProvenanceOptions
): JsonLdNode {
  const pageUrl = absoluteHttpUrl(options.pageUrl);
  const mainEntityId = absoluteHttpUrl(options.mainEntityId);
  const ownerIdentityId = absoluteHttpUrl(options.ownerIdentityId);
  if (!pageUrl || !mainEntityId || !ownerIdentityId) return options.structuredData;

  const webpageId = pageNodeId(pageUrl);
  const graph = jsonLdGraph(options.structuredData).filter((node) => {
    const nodeId = String(node["@id"] || "");
    return nodeId !== TRADESCOUT_PUBLISHER_ID && nodeId !== webpageId;
  });
  const publisherReference = { "@id": TRADESCOUT_PUBLISHER_ID };

  return {
    "@context": options.structuredData["@context"] || "https://schema.org",
    "@graph": [
      ...graph,
      {
        "@type": "Organization",
        "@id": TRADESCOUT_PUBLISHER_ID,
        name: "TradeScout",
        url: TRADESCOUT_PUBLISHER_URL,
      },
      {
        "@type": options.pageType || "WebPage",
        "@id": webpageId,
        url: pageUrl,
        mainEntity: {
          "@id": mainEntityId,
        },
        about: {
          "@id": ownerIdentityId,
        },
        publisher: publisherReference,
        provider: publisherReference,
      },
    ],
  };
}
