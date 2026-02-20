#!/usr/bin/env node

const hookUrl = process.env.RENDER_DEPLOY_HOOK_URL?.trim();

if (!hookUrl) {
  console.error("Missing RENDER_DEPLOY_HOOK_URL.");
  console.error("Set it in your shell, then run: npm run deploy:render");
  process.exit(1);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(hookUrl, {
    method: "POST",
    signal: controller.signal,
    headers: { Accept: "application/json,text/plain,*/*" },
  });

  clearTimeout(timeout);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`Render deploy hook failed: ${response.status} ${response.statusText}`);
    if (body) console.error(body.slice(0, 500));
    process.exit(1);
  }

  console.log("Render deploy hook triggered successfully.");
} catch (error) {
  clearTimeout(timeout);
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Render deploy hook request failed: ${message}`);
  process.exit(1);
}
