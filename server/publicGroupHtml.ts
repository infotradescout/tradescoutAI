import { sanitizePublicDiscoveryText } from "@shared/publicListingSafety";
import { storage } from "./storage";

const GROUP_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_GROUP_ID_LENGTH = 128;

export type PublicGroupHtmlOptions = {
  groupId: string;
  postId?: string | null;
  origin: string;
  templateHtml: string;
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTag(html: string, pattern: RegExp, tag: string): string {
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace(/<\/head>/i, `${tag}\n</head>`);
}

function normalizeGroupId(value: unknown): string | null {
  const groupId = String(value || "").trim();
  return groupId && groupId.length <= MAX_GROUP_ID_LENGTH && GROUP_ID_PATTERN.test(groupId)
    ? groupId
    : null;
}

function normalizeOrigin(value: unknown): string | null {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function normalizePublicImageUrl(value: unknown, origin: string): string | null {
  const candidate = String(value || "").trim();
  if (!candidate || candidate.length > 2_048 || /[\r\n\\\0]/.test(candidate)) return null;
  try {
    const parsed = new URL(candidate, origin);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function imageMimeType(url: string): string {
  const pathname = url.split(/[?#]/, 1)[0].toLowerCase();
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".gif")) return "image/gif";
  return "image/png";
}

function groupLocation(group: any): string {
  const city = sanitizePublicDiscoveryText(group?.cityName, 80);
  const region = sanitizePublicDiscoveryText(group?.regionName, 80);
  const stateCandidate = String(group?.stateCode || "")
    .trim()
    .toUpperCase();
  const state = /^[A-Z]{2}$/.test(stateCandidate) ? stateCandidate : "";
  if (city) return state ? `${city}, ${state}` : city;
  if (region) return state ? `${region}, ${state}` : region;
  return state;
}

function groupTypeLabel(value: unknown): string {
  return sanitizePublicDiscoveryText(String(value || "").replace(/[_-]+/g, " "), 50)
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

function injectSummary(html: string, summaryHtml: string): string {
  return html.replace(/<div id="root">\s*<\/div>/i, `<div id="root">${summaryHtml}</div>`);
}

export async function buildPublicGroupHtml({
  groupId: rawGroupId,
  postId: rawPostId,
  origin: rawOrigin,
  templateHtml,
}: PublicGroupHtmlOptions): Promise<string | null> {
  const groupId = normalizeGroupId(rawGroupId);
  const requestedPostId = rawPostId ? normalizeGroupId(rawPostId) : null;
  const origin = normalizeOrigin(rawOrigin);
  if (!groupId || (rawPostId && !requestedPostId) || !origin || !templateHtml) return null;

  let group: any;
  try {
    group = await storage.getGroupById(groupId);
  } catch {
    return null;
  }

  // Group visibility is an explicit publication boundary. Unknown, inactive,
  // and private records never receive a public share document.
  if (!group || group.isPrivate !== false || group.isActive !== true) return null;

  const name = sanitizePublicDiscoveryText(group.name, 100);
  if (!name) return null;

  let publicPost: any = null;
  if (requestedPostId) {
    try {
      const expectedGroupTag = `group:${groupId}`;
      const post = await storage.getCommunityPost(requestedPostId);
      publicPost =
        String(post?.id || "") === requestedPostId &&
        post?.isPublished === true &&
        post?.isHidden === false &&
        Array.isArray(post?.tags) &&
        post.tags.includes(expectedGroupTag)
          ? post
          : null;
    } catch {
      return null;
    }
    if (!publicPost) return null;
  }

  const location = groupLocation(group);
  const typeLabel = groupTypeLabel(group.groupType);
  const groupDescription =
    sanitizePublicDiscoveryText(group.description, 180) ||
    `${name} is a TradeScout community group${
      location ? ` for ${location}` : ""
    }. View updates, meet local members, and join the conversation.`;
  const postContent = publicPost ? sanitizePublicDiscoveryText(publicPost.content, 180) : "";
  const postTitle = publicPost
    ? sanitizePublicDiscoveryText(publicPost.title || publicPost.content, 100) ||
      `${name} community post`
    : "";
  const description = publicPost ? postContent || groupDescription : groupDescription;
  const canonicalBase = `${origin}/group/${encodeURIComponent(groupId)}`;
  const canonical = requestedPostId
    ? `${canonicalBase}?post=${encodeURIComponent(requestedPostId)}`
    : canonicalBase;
  const groupSourceImageUrl =
    normalizePublicImageUrl(group.bannerUrl, origin) ||
    normalizePublicImageUrl(group.imageUrl, origin);
  const postImages = publicPost
    ? Array.isArray(publicPost.imageUrls)
      ? publicPost.imageUrls
      : Array.isArray(publicPost.images)
        ? publicPost.images
        : []
    : [];
  const sourceImageUrl = normalizePublicImageUrl(postImages[0], origin) || groupSourceImageUrl;
  const imageUrl = sourceImageUrl || `${origin}/tradescout-social-preview.png?v=12`;
  const imageAlt = publicPost
    ? `${postTitle} in ${name} preview`
    : `${name} community group preview`;
  const memberCount = Number(group.memberCount);
  const memberLabel =
    Number.isFinite(memberCount) && memberCount >= 0
      ? `${Math.floor(memberCount).toLocaleString("en-US")} members`
      : "";
  const title = publicPost
    ? `${postTitle} | ${name} | TradeScout Groups`
    : `${name} | TradeScout Groups`;

  let html = templateHtml.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`
  );
  const tags: Array<[RegExp, string]> = [
    [
      /<meta name="description"[^>]*>/i,
      `<meta name="description" content="${escapeHtml(description)}" />`,
    ],
    [
      /<meta name="robots"[^>]*>/i,
      '<meta name="robots" content="index, follow, max-image-preview:large" />',
    ],
    [/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`],
    [
      /<meta property="og:type"[^>]*>/i,
      `<meta property="og:type" content="${publicPost ? "article" : "website"}" />`,
    ],
    [
      /<meta property="og:site_name"[^>]*>/i,
      '<meta property="og:site_name" content="TradeScout Groups" />',
    ],
    [
      /<meta property="og:title"[^>]*>/i,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
    ],
    [
      /<meta property="og:description"[^>]*>/i,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
    ],
    [
      /<meta property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    ],
    [
      /<meta property="og:image"[^>]*>/i,
      `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    ],
    [
      /<meta property="og:image:secure_url"[^>]*>/i,
      `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`,
    ],
    [
      /<meta property="og:image:type"[^>]*>/i,
      `<meta property="og:image:type" content="${imageMimeType(imageUrl)}" />`,
    ],
    [
      /<meta property="og:image:alt"[^>]*>/i,
      `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`,
    ],
    [
      /<meta name="twitter:card"[^>]*>/i,
      '<meta name="twitter:card" content="summary_large_image" />',
    ],
    [
      /<meta name="twitter:title"[^>]*>/i,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    ],
    [
      /<meta name="twitter:description"[^>]*>/i,
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    ],
    [
      /<meta name="twitter:image"[^>]*>/i,
      `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    ],
    [
      /<meta name="twitter:image:alt"[^>]*>/i,
      `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`,
    ],
  ];
  for (const [pattern, tag] of tags) html = upsertTag(html, pattern, tag);

  if (sourceImageUrl) {
    html = html
      .replace(/<meta property="og:image:width"[^>]*>\s*/gi, "")
      .replace(/<meta property="og:image:height"[^>]*>\s*/gi, "");
  } else {
    html = upsertTag(
      html,
      /<meta property="og:image:width"[^>]*>/i,
      '<meta property="og:image:width" content="1200" />'
    );
    html = upsertTag(
      html,
      /<meta property="og:image:height"[^>]*>/i,
      '<meta property="og:image:height" content="630" />'
    );
  }

  const summary = `
<main ${publicPost ? `data-seo-group-post="${escapeHtml(requestedPostId || "")}"` : 'data-seo-group="true"'} style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(publicPost ? postTitle : name)}</h1>
    <p>${escapeHtml(description)}</p>
    ${publicPost ? `<p><strong>Group:</strong> ${escapeHtml(name)}</p>` : ""}
    ${location ? `<p><strong>Area:</strong> ${escapeHtml(location)}</p>` : ""}
    ${typeLabel ? `<p><strong>Group:</strong> ${escapeHtml(typeLabel)}</p>` : ""}
    ${memberLabel ? `<p>${escapeHtml(memberLabel)}</p>` : ""}
    ${sourceImageUrl ? `<img src="${escapeHtml(sourceImageUrl)}" alt="${escapeHtml(imageAlt)}" loading="eager" />` : ""}
    <p>Open TradeScout to view this group and join the conversation.</p>
  </article>
</main>`;

  return injectSummary(html, summary);
}
