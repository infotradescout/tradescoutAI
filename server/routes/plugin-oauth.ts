import { Router } from "express";
import { pool } from "../db";
import { isAuthenticated } from "../auth";
import {
  isPluginOAuthConfigured,
  issueAccessToken,
  normalizeScopes,
  opaqueSecret,
  parsePluginClients,
  pluginAudience,
  pluginIssuer,
  publicJwk,
  resolveClient,
  secretHash,
  verifyPkce,
} from "../plugin/oauth";

const router = Router();

const PLUGIN_OAUTH_ROUTE_PATHS = new Set([
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/.well-known/jwks.json",
  "/oauth/authorize",
  "/oauth/token",
]);

export function isPluginOAuthRoutePath(value: unknown): boolean {
  return typeof value === "string" && PLUGIN_OAUTH_ROUTE_PATHS.has(value.trim());
}

export function requirePluginOAuthConfiguration(req: any, res: any, next: () => void) {
  // This router is mounted at the application root. The configuration gate must
  // therefore own only the OAuth/JWKS paths; otherwise a disabled plugin setup
  // turns every unrelated route, including /api/health, into a false 404.
  if (!isPluginOAuthRoutePath(req.path)) return next();

  if (!isPluginOAuthConfigured()) {
    res.setHeader("cache-control", "no-store");
    return res.status(404).json({ error: "not_found" });
  }
  return next();
}

router.use(requirePluginOAuthConfiguration);

function ownerId(req: any) {
  return String(req.user?.id || req.user?.claims?.sub || "").trim();
}

function publicOrigin(req: any) {
  return pluginIssuer() || `${req.protocol}://${req.get("host")}`;
}

router.get("/.well-known/oauth-authorization-server", (_req, res) => {
  const issuer = pluginIssuer();
  res.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["business.read", "profile.write", "services.write", "documents.write"],
  });
});

router.get("/.well-known/oauth-protected-resource", (_req, res) => {
  const issuer = pluginIssuer();
  res.json({
    resource: pluginAudience(),
    authorization_servers: [issuer],
    scopes_supported: ["business.read", "profile.write", "services.write", "documents.write"],
  });
});

router.get("/.well-known/jwks.json", (_req, res) => {
  res.json({ keys: [publicJwk()] });
});

router.get("/oauth/authorize", isAuthenticated, async (req, res) => {
  try {
    const responseType = String(req.query.response_type || "");
    const clientId = String(req.query.client_id || "");
    const redirectUri = String(req.query.redirect_uri || "");
    const state = String(req.query.state || "");
    const challenge = String(req.query.code_challenge || "");
    const method = String(req.query.code_challenge_method || "");
    const scopes = normalizeScopes(String(req.query.scope || "business.read"));
    const client = resolveClient(clientId, redirectUri);
    if (
      responseType !== "code" ||
      !client ||
      !state ||
      method !== "S256" ||
      !/^[A-Za-z0-9_-]{43}$/.test(challenge)
    ) {
      return res.status(400).json({ error: "invalid_request" });
    }
    const userId = ownerId(req);
    if (!userId) return res.status(401).json({ error: "login_required" });

    const approval = opaqueSecret();
    await pool.query(
      `INSERT INTO plugin_oauth_approvals
       (token_hash, user_id, client_id, redirect_uri, scopes, code_challenge, state, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW() + INTERVAL '10 minutes')`,
      [secretHash(approval), userId, clientId, redirectUri, scopes, challenge, state]
    );

    res.setHeader("content-type", "text/html; charset=utf-8");
    res.send(`<!doctype html><html><body><main>
      <h1>Connect ${escapeHtml(client.name)} to TradeScout</h1>
      <p>This grants access to: ${scopes.map(escapeHtml).join(", ")}.</p>
      <form method="post" action="${publicOrigin(req)}/oauth/authorize">
        <input type="hidden" name="approval_token" value="${approval}">
        <button name="decision" value="approve" type="submit">Approve</button>
        <button name="decision" value="deny" type="submit">Deny</button>
      </form></main></body></html>`);
  } catch {
    res.status(400).json({ error: "invalid_request" });
  }
});

router.post("/oauth/authorize", isAuthenticated, async (req, res) => {
  const approval = String(req.body.approval_token || "");
  const result = await pool.query(
    `DELETE FROM plugin_oauth_approvals
     WHERE token_hash=$1 AND user_id=$2 AND expires_at > NOW()
     RETURNING user_id, client_id, redirect_uri, scopes, code_challenge, state`,
    [secretHash(approval), ownerId(req)]
  );
  const pending = result.rows[0];
  if (!pending) return res.status(400).json({ error: "invalid_request" });
  const redirect = new URL(pending.redirect_uri);
  redirect.searchParams.set("state", pending.state);
  if (req.body.decision !== "approve") {
    redirect.searchParams.set("error", "access_denied");
    return res.redirect(303, redirect.toString());
  }
  const code = opaqueSecret();
  await pool.query(
    `INSERT INTO plugin_oauth_codes
     (code_hash, user_id, client_id, redirect_uri, scopes, code_challenge, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW() + INTERVAL '5 minutes')`,
    [
      secretHash(code),
      pending.user_id,
      pending.client_id,
      pending.redirect_uri,
      pending.scopes,
      pending.code_challenge,
    ]
  );
  redirect.searchParams.set("code", code);
  res.redirect(303, redirect.toString());
});

router.post("/oauth/token", async (req, res) => {
  try {
    if (req.body.grant_type !== "authorization_code") {
      return res.status(400).json({ error: "unsupported_grant_type" });
    }
    const code = String(req.body.code || "");
    const clientId = String(req.body.client_id || "");
    const redirectUri = String(req.body.redirect_uri || "");
    const verifier = String(req.body.code_verifier || "");
    if (!resolveClient(clientId, redirectUri)) {
      return res.status(400).json({ error: "invalid_client" });
    }
    const result = await pool.query(
      `DELETE FROM plugin_oauth_codes
       WHERE code_hash=$1 AND client_id=$2 AND redirect_uri=$3 AND expires_at > NOW()
       RETURNING user_id, scopes, code_challenge`,
      [secretHash(code), clientId, redirectUri]
    );
    const grant = result.rows[0];
    if (!grant || !verifyPkce(verifier, grant.code_challenge)) {
      return res.status(400).json({ error: "invalid_grant" });
    }
    const scopes = normalizeScopes((grant.scopes as string[]).join(" "));
    res.setHeader("cache-control", "no-store");
    res.json({
      access_token: issueAccessToken({ subject: grant.user_id, clientId, scopes }),
      token_type: "Bearer",
      expires_in: 900,
      scope: scopes.join(" "),
    });
  } catch {
    res.status(400).json({ error: "invalid_request" });
  }
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}

export { router as pluginOAuthRouter };
