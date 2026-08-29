import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "crypto";
import jwt from "jsonwebtoken";

export const PLUGIN_SCOPES = [
  "business.read",
  "profile.write",
  "services.write",
  "documents.write",
] as const;

export type PluginScope = (typeof PLUGIN_SCOPES)[number];

type ClientConfig = {
  clientId: string;
  redirectUris: string[];
  name: string;
};

export function parsePluginClients(raw = process.env.TRADESCOUT_PLUGIN_OAUTH_CLIENTS || "") {
  if (!raw.trim()) return [] as ClientConfig[];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed))
    throw new Error("TRADESCOUT_PLUGIN_OAUTH_CLIENTS must be a JSON array");
  return parsed.map((item) => {
    const value = item as Partial<ClientConfig>;
    if (
      !value.clientId ||
      !value.name ||
      !Array.isArray(value.redirectUris) ||
      value.redirectUris.length === 0 ||
      value.redirectUris.some((uri) => !/^https:\/\//i.test(uri))
    ) {
      throw new Error("Invalid TradeScout plugin OAuth client configuration");
    }
    return {
      clientId: String(value.clientId),
      name: String(value.name),
      redirectUris: value.redirectUris.map(String),
    };
  });
}

export function resolveClient(clientId: string, redirectUri: string): ClientConfig | null {
  return (
    parsePluginClients().find(
      (client) => client.clientId === clientId && client.redirectUris.includes(redirectUri)
    ) || null
  );
}

export function normalizeScopes(value: string): PluginScope[] {
  const requested = Array.from(new Set(value.split(/\s+/).filter(Boolean)));
  if (!requested.includes("business.read")) throw new Error("business.read is required");
  if (requested.some((scope) => !PLUGIN_SCOPES.includes(scope as PluginScope))) {
    throw new Error("Unsupported scope");
  }
  return requested as PluginScope[];
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const actual = createHash("sha256").update(verifier).digest("base64url");
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(challenge);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function privateKeyPem(env: NodeJS.ProcessEnv = process.env) {
  return env.TRADESCOUT_PLUGIN_JWT_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";
}

function signingKey() {
  const pem = privateKeyPem();
  if (!pem) throw new Error("TRADESCOUT_PLUGIN_JWT_PRIVATE_KEY is required");
  return createPrivateKey(pem);
}

export function pluginIssuer() {
  const value = String(process.env.TRADESCOUT_PLUGIN_ISSUER || "").replace(/\/$/, "");
  if (!/^https:\/\//i.test(value)) throw new Error("TRADESCOUT_PLUGIN_ISSUER must be HTTPS");
  return value;
}

export function pluginAudience() {
  const value = String(process.env.TRADESCOUT_PLUGIN_AUDIENCE || "").trim();
  if (!value) throw new Error("TRADESCOUT_PLUGIN_AUDIENCE is required");
  return value;
}

export function isPluginOAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const issuer = String(env.TRADESCOUT_PLUGIN_ISSUER || "").replace(/\/$/, "");
  const audience = String(env.TRADESCOUT_PLUGIN_AUDIENCE || "").trim();
  const keyPem = privateKeyPem(env);

  if (!keyPem || !audience || !/^https:\/\//i.test(issuer)) return false;

  try {
    createPrivateKey(keyPem);
    const clients = parsePluginClients(env.TRADESCOUT_PLUGIN_OAUTH_CLIENTS || "");
    return clients.length > 0;
  } catch {
    return false;
  }
}

export function publicJwk() {
  const jwk = createPublicKey(signingKey()).export({ format: "jwk" });
  return { ...jwk, use: "sig", alg: "RS256", kid: "tradescout-plugin-v1" };
}

export function issueAccessToken(input: {
  subject: string;
  clientId: string;
  scopes: PluginScope[];
}) {
  return jwt.sign(
    {
      tenant_id: `tradescout:${input.subject}`,
      scope: input.scopes.join(" "),
    },
    signingKey(),
    {
      algorithm: "RS256",
      audience: pluginAudience(),
      issuer: pluginIssuer(),
      subject: input.subject,
      keyid: "tradescout-plugin-v1",
      jwtid: randomUUID(),
      expiresIn: "15m",
    }
  );
}

export function opaqueSecret() {
  return randomBytes(32).toString("base64url");
}

export function secretHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
