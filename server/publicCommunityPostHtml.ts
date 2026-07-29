import { formatTradeScoutTitle } from "@shared/brand";
import {
  createCommunityPostShareMetadata,
  normalizeCommunityPostId,
} from "@shared/communityPostShare";
import { storage } from "./storage";
import { toPublicCommunityPost } from "./publicCommunityPost";

type PublicCommunityPostHtmlOptions = {
  postId: string;
  origin: string;
  templateHtml: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTag(html: string, regex: RegExp, tag: string): string {
  if (regex.test(html)) return html.replace(regex, tag);
  return html.replace("</head>", `${tag}\n</head>`);
}

function imageMimeType(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

function injectJsonLd(html: string, jsonLd: object): string {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  return html.replace("</head>", `<script type="application/ld+json">${json}</script>\n</head>`);
}

function absolutePublicUrl(value: string, origin: string): string {
  try {
    return new URL(value, origin).toString();
  } catch {
    return value;
  }
}

function buildCrawlerPostSummary(args: {
  publicPost: NonNullable<ReturnType<typeof toPublicCommunityPost>>;
  canonical: string;
  imageUrl: string | null;
  origin: string;
}): string {
  const { publicPost, canonical, imageUrl, origin } = args;
  const heading = publicPost.title?.trim() || `Community post by ${publicPost.author.name}`;
  const location = [publicPost.cityName, publicPost.stateCode].filter(Boolean).join(", ");
  const published = publicPost.createdAt?.toISOString();
  const tags = publicPost.tags
    .slice(0, 12)
    .map((tag) => `<li>${escapeHtml(tag)}</li>`)
    .join("");

  return `<main data-seo-community-post="${escapeHtml(publicPost.id)}">
    <article>
      <header>
        <p><a href="${escapeHtml(origin)}/community">TradeScout Community</a></p>
        <h1>${escapeHtml(heading)}</h1>
        <p>By ${escapeHtml(publicPost.author.name)}${publicPost.author.verified ? " — verified member" : ""}${location ? ` · ${escapeHtml(location)}` : ""}${published ? ` · <time datetime="${escapeHtml(published)}">${escapeHtml(publicPost.createdAt!.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }))}</time>` : ""}</p>
      </header>
      ${imageUrl ? `<img src="${escapeHtml(absolutePublicUrl(imageUrl, origin))}" alt="${escapeHtml(heading)}" />` : ""}
      <p>${escapeHtml(publicPost.content)}</p>
      ${tags ? `<section aria-label="Topics"><h2>Topics</h2><ul>${tags}</ul></section>` : ""}
      <footer>
        <p>${publicPost.likeCount} likes · ${publicPost.commentCount} comments · ${publicPost.shareCount} shares</p>
        <p><a href="${escapeHtml(canonical)}">View this post on TradeScout</a></p>
      </footer>
    </article>
  </main>`;
}

export async function buildPublicCommunityPostHtml({
  postId,
  origin,
  templateHtml,
}: PublicCommunityPostHtmlOptions): Promise<string | null> {
  const safePostId = normalizeCommunityPostId(postId);
  if (!safePostId) return null;

  const post = await storage.getCommunityPost(safePostId);
  if (!post || post.isPublished !== true || post.isHidden === true) return null;
  const author = await storage.getUser(post.authorId);
  const publicPost = toPublicCommunityPost(post, author);
  if (!publicPost) return null;

  const meta = createCommunityPostShareMetadata({ post: publicPost, origin });
  if (!meta) return null;

  const title = formatTradeScoutTitle(meta.title);
  const imageUrl = meta.imageUrl || `${origin}/tradescout-social-preview.png?v=12`;
  const usesDefaultImage = !meta.imageUrl;
  const postImageUrl = meta.imageUrl ? absolutePublicUrl(meta.imageUrl, origin) : null;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    "@id": `${meta.canonical}#post`,
    headline: meta.title,
    articleBody: publicPost.content,
    image: postImageUrl ? [postImageUrl] : undefined,
    datePublished: publicPost.createdAt?.toISOString(),
    dateModified: publicPost.updatedAt?.toISOString(),
    author: {
      "@type": "Person",
      name: publicPost.author.name,
    },
    publisher: {
      "@type": "Organization",
      name: "TradeScout",
      url: origin,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": meta.canonical,
    },
    about: [publicPost.category, publicPost.cityName, publicPost.stateCode]
      .filter(Boolean)
      .join(", "),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: publicPost.likeCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: publicPost.commentCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ShareAction",
        userInteractionCount: publicPost.shareCount,
      },
    ],
    url: meta.canonical,
  };

  let html = templateHtml;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="robots"[^>]*>/i,
    '<meta name="robots" content="index, follow, max-image-preview:large" />'
  );
  html = upsertTag(
    html,
    /<meta property="og:type"[^>]*>/i,
    '<meta property="og:type" content="article" />'
  );
  html = upsertTag(
    html,
    /<meta property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(title)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:secure_url"[^>]*>/i,
    `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:type"[^>]*>/i,
    `<meta property="og:image:type" content="${imageMimeType(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:alt"[^>]*>/i,
    `<meta property="og:image:alt" content="${escapeHtml(meta.imageAlt)}" />`
  );
  if (usesDefaultImage) {
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
  } else {
    html = html
      .replace(/<meta property="og:image:width"[^>]*>\s*/gi, "")
      .replace(/<meta property="og:image:height"[^>]*>\s*/gi, "");
  }
  html = upsertTag(
    html,
    /<meta name="twitter:card"[^>]*>/i,
    '<meta name="twitter:card" content="summary_large_image" />'
  );
  html = upsertTag(
    html,
    /<meta name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image:alt"[^>]*>/i,
    `<meta name="twitter:image:alt" content="${escapeHtml(meta.imageAlt)}" />`
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`
  );
  html = injectJsonLd(html, structuredData);
  html = html.replace(
    "</head>",
    '<meta name="tradescout:community-access" content="read-only-global" />\n</head>'
  );
  html = html.replace(
    /<div id="root">\s*<\/div>/i,
    `<div id="root">${buildCrawlerPostSummary({
      publicPost,
      canonical: meta.canonical,
      imageUrl: postImageUrl,
      origin,
    })}</div>`
