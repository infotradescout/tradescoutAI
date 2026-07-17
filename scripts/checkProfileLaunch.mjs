/*
 * Pre-launch checklist for onboarding a business profile.
 *
 * Checks the things that, in practice, only surface after a business is
 * already live and someone notices something's wrong: missing/unreachable
 * favicon or share image, a custom domain that's set in the DB but not
 * actually wired up in DNS, or a redirect that doesn't behave.
 *
 * Usage: node scripts/checkProfileLaunch.mjs <profile-slug>
 */
import "dotenv/config";
import { Client } from "pg";

const JRS_PROFILE_SLUG = "jrs-auto-glass";
const OWNER_CONFIRMED_PROFILE_SOURCE = "owner_confirmed_profile";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/checkProfileLaunch.mjs <profile-slug>");
  process.exit(1);
}

const results = [];
function report(status, label, detail) {
  results.push({ status, label, detail });
  const icon = status === "ok" ? "✅" : status === "warn" ? "⚠️ " : "❌";
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function checkUrl(url, timeoutMs = 8000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: "GET", redirect: "manual", signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.status >= 200 && res.status < 400, status: res.status };
  } catch (err) {
    return { ok: false, status: null, error: err.message };
  }
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const { rows } = await client.query(
    `SELECT id, slug, display_name, status, owner_user_id, business_id, seo_meta
     FROM profiles WHERE slug = $1`,
    [slug]
  );
  const profile = rows[0];

  if (!profile) {
    report("fail", `Profile "${slug}" not found`);
    process.exit(1);
  }

  console.log(`\nChecking profile: ${profile.display_name} (${slug})\n`);

  report(
    profile.status === "published" ? "ok" : "warn",
    `Status is "${profile.status}"`,
    profile.status === "published" ? undefined : "won't be publicly visible until published"
  );

  const seo = profile.seo_meta || {};

  report(
    seo.title ? "ok" : "warn",
    "SEO title set",
    seo.title ? undefined : "falls back to an auto-generated title"
  );
  report(
    seo.description ? "ok" : "warn",
    "SEO description set",
    seo.description ? undefined : "falls back to an auto-generated description"
  );

  if (seo.imageUrl) {
    const check = await checkUrl(seo.imageUrl);
    report(
      check.ok ? "ok" : "fail",
      "Share image (OG banner) reachable",
      `${seo.imageUrl} -> ${check.status ?? check.error}`
    );
  } else {
    report("warn", "No share image set", "link previews will use the generic TradeScout banner");
  }

  if (seo.faviconUrl) {
    const check = await checkUrl(seo.faviconUrl);
    report(
      check.ok ? "ok" : "fail",
      "Favicon reachable",
      `${seo.faviconUrl} -> ${check.status ?? check.error}`
    );
  } else if (seo.imageUrl) {
    report(
      "warn",
      "No favicon set",
      "browser tab will fall back to the wide share image, not a square crop"
    );
  }

  if (seo.customDomain) {
    const domain = String(seo.customDomain).trim().toLowerCase();
    console.log(`\nCustom domain: ${domain}\n`);

    const domainCheck = await checkUrl(`https://${domain}/`);
    report(
      domainCheck.ok ? "ok" : "fail",
      `https://${domain}/ reachable`,
      `-> ${domainCheck.status ?? domainCheck.error}`
    );

    const robotsCheck = await checkUrl(`https://${domain}/robots.txt`);
    report(
      robotsCheck.ok ? "ok" : "fail",
      "robots.txt reachable on custom domain",
      `-> ${robotsCheck.status ?? robotsCheck.error}`
    );

    const sitemapCheck = await checkUrl(`https://${domain}/sitemap.xml`);
    report(
      sitemapCheck.ok ? "ok" : "fail",
      "sitemap.xml reachable on custom domain",
      `-> ${sitemapCheck.status ?? sitemapCheck.error}`
    );

    const redirectCheck = await fetch(
      `https://www.thetradescout.com/u/${encodeURIComponent(slug)}`,
      {
        redirect: "manual",
      }
    ).catch((err) => ({ status: null, headers: new Map(), error: err.message }));
    const location = redirectCheck.headers?.get?.("location");
    const redirectsCorrectly =
      redirectCheck.status === 301 &&
      location &&
      location.replace(/\/$/, "") === `https://${domain}`;
    report(
      redirectsCorrectly ? "ok" : "fail",
      `/u/${slug} redirects to the custom domain`,
      redirectsCorrectly
        ? undefined
        : `got status=${redirectCheck.status} location=${location ?? "none"}`
    );

    const apexCheck = await checkUrl(`https://${domain.replace(/^www\./, "")}/`);
    report(
      apexCheck.ok ? "ok" : "warn",
      `Apex domain (no www) reachable`,
      apexCheck.ok
        ? undefined
        : `${apexCheck.status ?? apexCheck.error} -- check DNS/certificate if this is meant to work`
    );
  } else {
    const canonicalUrl = `https://www.thetradescout.com/u/${encodeURIComponent(slug)}`;
    const canonicalCheck = await checkUrl(canonicalUrl);
    report(
      canonicalCheck.ok ? "ok" : "fail",
      "Canonical TradeScout profile reachable",
      `${canonicalUrl} -> ${canonicalCheck.status ?? canonicalCheck.error}`
    );
  }

  if (profile.business_id) {
    const { rows: bizRows } = await client.query(
      `SELECT
         owner_user_id,
         status,
         public_discovery_enabled,
         sources,
         length(trim(coalesce(profile_data ->> 'phone', ''))) > 0 AS has_phone,
         length(trim(coalesce(profile_data ->> 'notificationEmail', ''))) > 0
           AS has_notification_email
       FROM businesses
       WHERE id = $1`,
      [profile.business_id]
    );
    const business = bizRows[0];
    if (business) {
      report(
        business.status === "active" ? "ok" : "warn",
        `Linked business status is "${business.status}"`
      );
      const ownerConfirmedDirectProfile =
        slug === JRS_PROFILE_SLUG &&
        profile.status === "published" &&
        business.status === "active" &&
        String(profile.owner_user_id || "") === String(business.owner_user_id || "") &&
        business.public_discovery_enabled === false &&
        Array.isArray(business.sources) &&
        business.sources.includes(OWNER_CONFIRMED_PROFILE_SOURCE);
      if (business.public_discovery_enabled) {
        report("ok", "Public discovery enabled on linked business");
      } else if (ownerConfirmedDirectProfile) {
        report(
          "ok",
          "Owner-confirmed direct profile scope active",
          "profile stays out of directory discovery while its protected request path remains available"
        );
      } else {
        report(
          "warn",
          "Public discovery disabled on linked business",
          "business will not surface in directory/search"
        );
      }
      report(
        "ok",
        business.has_phone ? "Express call mode ready" : "Express call mode disabled",
        business.has_phone
          ? "private routing phone is configured"
          : "no private phone is configured; the public profile must remain request-only"
      );
      report(
        business.has_notification_email ? "ok" : "warn",
        business.has_notification_email
          ? "Request notification email configured"
          : "Request notification email not configured",
        business.has_notification_email
          ? undefined
          : "requests still create in-app assignments, but email notification is unavailable"
      );
    }
  }

  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;
  console.log(`\n${failed} failed, ${warned} warnings, ${results.length - failed - warned} ok\n`);
  process.exitCode = failed > 0 ? 1 : 0;
} finally {
  await client.end();
}
