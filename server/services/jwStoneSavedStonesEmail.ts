import { resolveJwStonePublicRequestName } from "@shared/jwStonePresentation";
import { JW_STONE_DIRECT_CONNECT_SELECTION_LIMIT } from "@shared/jwStoneDirectConnect";

export const JW_STONE_SAVED_STONES_EMAIL_PURPOSE = "jw_stone_saved_stones_copy" as const;

const SHARE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type JwStoneSavedStoneEmailItem = {
  name: string;
  shareSlug: string | null;
};

export function sanitizeJwStoneSavedStoneEmailItems(value: unknown): JwStoneSavedStoneEmailItem[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: JwStoneSavedStoneEmailItem[] = [];

  for (const candidate of value.slice(0, JW_STONE_DIRECT_CONNECT_SELECTION_LIMIT)) {
    if (!candidate || typeof candidate !== "object") continue;
    const rawName = String((candidate as { name?: unknown }).name || "").trim();
    const rawSlug = String(
      (candidate as { shareSlug?: unknown }).shareSlug ||
        (candidate as { itemId?: unknown }).itemId ||
        ""
    )
      .trim()
      .toLowerCase();

    const name = resolveJwStonePublicRequestName({
      profileSlug: "jw-stone",
      itemId: rawSlug || undefined,
      stoneName: rawName,
    });
    if (!name) continue;

    const shareSlug =
      rawSlug && SHARE_SLUG_PATTERN.test(rawSlug) && rawSlug.length <= 120 ? rawSlug : null;
    const dedupeKey = shareSlug || name.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    items.push({ name, shareSlug });
  }

  return items;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildJwStoneSavedStonesEmail(args: {
  publicBaseUrl: string;
  stones: readonly JwStoneSavedStoneEmailItem[];
}): { subject: string; html: string; text: string } {
  const base = String(args.publicBaseUrl || "https://www.thetradescout.com").replace(/\/$/, "");
  const stones = args.stones;
  const countLabel = stones.length === 1 ? "1 saved stone" : `${stones.length} saved stones`;

  const htmlItems = stones
    .map((stone) => {
      const label = escapeHtml(stone.name);
      if (!stone.shareSlug) return `<li>${label}</li>`;
      const href = `${base}/jw-stone/stones/${encodeURIComponent(stone.shareSlug)}`;
      return `<li><a href="${href}">${label}</a></li>`;
    })
    .join("\n");

  const textItems = stones
    .map((stone) => {
      if (!stone.shareSlug) return `- ${stone.name}`;
      return `- ${stone.name}: ${base}/jw-stone/stones/${encodeURIComponent(stone.shareSlug)}`;
    })
    .join("\n");

  return {
    subject: `Your JW Stone saved list (${countLabel})`,
    html: [
      "<p>Here is a copy of the stones you saved on JW Stone.</p>",
      "<p>This list was saved in your browser. Keep this email as a durable copy — clearing cache or switching devices will not remove it from your inbox.</p>",
      `<ul>\n${htmlItems}\n</ul>`,
      `<p><a href="${base}/jw-stone">Return to JW Stone</a></p>`,
      "<p>JW Stone is not notified when you email this list to yourself. Start a request from the site when you are ready to talk materials.</p>",
    ].join("\n"),
    text: [
      "Here is a copy of the stones you saved on JW Stone.",
      "",
      "This list was saved in your browser. Keep this email as a durable copy — clearing cache or switching devices will not remove it from your inbox.",
      "",
      textItems,
      "",
      `Return to JW Stone: ${base}/jw-stone`,
      "",
      "JW Stone is not notified when you email this list to yourself. Start a request from the site when you are ready to talk materials.",
    ].join("\n"),
  };
}
