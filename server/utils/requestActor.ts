import crypto from "crypto";
import type { Request } from "express";

export type ActorType = "human" | "bot" | "unknown";
export type RequestType = "page" | "api" | "asset" | "unknown";

const BOT_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /googlebot/i, name: "Googlebot" },
  { re: /google-inspectiontool/i, name: "Google-InspectionTool" },
  { re: /googleother/i, name: "GoogleOther" },
  { re: /google-extended/i, name: "Google-Extended" },
  { re: /bingbot/i, name: "Bingbot" },
  { re: /msnbot/i, name: "MSNBot" },
  { re: /petalbot/i, name: "PetalBot" },
  { re: /duckduckbot/i, name: "DuckDuckBot" },
  { re: /duckassistbot/i, name: "DuckAssistBot" },
  { re: /yandexbot/i, name: "YandexBot" },
  { re: /applebot-extended/i, name: "Applebot-Extended" },
  { re: /applebot/i, name: "Applebot" },
  { re: /baiduspider/i, name: "BaiduSpider" },
  { re: /slurp/i, name: "Yahoo Slurp" },
  { re: /facebookexternalhit/i, name: "FacebookExternalHit" },
  { re: /facebot/i, name: "Facebot" },
  { re: /meta-externalagent/i, name: "MetaExternalAgent" },
  { re: /meta-externalfetcher/i, name: "MetaExternalFetcher" },
  { re: /oai-searchbot/i, name: "OAI-SearchBot" },
  { re: /gptbot/i, name: "GPTBot" },
  { re: /chatgpt-user/i, name: "ChatGPT-User" },
  { re: /perplexitybot/i, name: "PerplexityBot" },
  { re: /perplexity-user/i, name: "Perplexity-User" },
  { re: /claude-user/i, name: "Claude-User" },
  { re: /anthropic-ai/i, name: "Anthropic-AI" },
  { re: /cohere-ai/i, name: "Cohere-AI" },
  { re: /mistralai-user/i, name: "MistralAI-User" },
  { re: /twitterbot/i, name: "TwitterBot" },
  { re: /linkedinbot/i, name: "LinkedInBot" },
  { re: /headlesschrome|phantomjs|selenium|playwright|puppeteer/i, name: "BrowserAutomation" },
  {
    re: /curl\/|wget\/|python-requests|python-urllib|aiohttp|httpx\/|go-http-client|libwww-perl|okhttp|axios\/|node-fetch|undici/i,
    name: "HttpAutomation",
  },
  {
    re: /lighthouse|pagespeed|pingdom|uptimerobot|statuscake/i,
    name: "SyntheticMonitor",
  },
  {
    re: /chrome\/[\d.]+.*safari\/605\.1\.15/i,
    name: "MalformedChrome",
  },
  { re: /crawler|spider|bot/i, name: "CrawlerBot" },
];

export const BOT_USER_AGENT_SQL_PATTERN = BOT_PATTERNS.map((rule) => rule.re.source)
  .join("|")
  .replace(/\\\//g, "/");

export function detectActorFromUserAgent(userAgent?: string | null): {
  actorType: ActorType;
  botName?: string;
} {
  const ua = String(userAgent || "").trim();
  if (!ua) return { actorType: "unknown" };
  for (const rule of BOT_PATTERNS) {
    if (rule.re.test(ua)) {
      return { actorType: "bot", botName: rule.name };
    }
  }
  return { actorType: "human" };
}

export function getClientIp(req: Request): { ip?: string; source?: string } {
  const cfIp = req.header("cf-connecting-ip");
  if (cfIp && cfIp.trim()) {
    return { ip: cfIp.trim(), source: "cf-connecting-ip" };
  }

  const xRealIp = req.header("x-real-ip");
  if (xRealIp && xRealIp.trim()) {
    return { ip: xRealIp.trim(), source: "x-real-ip" };
  }

  const xForwardedFor = req.header("x-forwarded-for");
  if (xForwardedFor && xForwardedFor.trim()) {
    const first = xForwardedFor
      .split(",")
      .map((v) => v.trim())
      .find(Boolean);
    if (first) return { ip: first, source: "x-forwarded-for" };
  }

  if (req.ip && req.ip.trim()) {
    return { ip: req.ip.trim(), source: "req.ip" };
  }

  const socketIp = req.socket?.remoteAddress;
  if (socketIp && socketIp.trim()) {
    return { ip: socketIp.trim(), source: "socket.remoteAddress" };
  }

  return {};
}

export function hashIp(ip?: string): string | undefined {
  if (!ip) return undefined;
  const salt = process.env.IP_HASH_SALT || "tradescout-ip-default-salt";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function classifyRequestType(path?: string | null): RequestType {
  if (!path || !path.trim()) return "unknown";
  const normalized = path.toLowerCase().trim();
  if (normalized.startsWith("/api")) return "api";
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|webp|avif)$/i.test(normalized)) {
    return "asset";
  }
  if (normalized.startsWith("/")) return "page";
  return "unknown";
}
