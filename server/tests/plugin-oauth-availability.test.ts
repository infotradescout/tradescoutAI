import { generateKeyPairSync } from "crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPluginOAuthConfigured } from "../plugin/oauth";
import { pluginOAuthRouter } from "../routes/plugin-oauth";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(pluginOAuthRouter);
  return app;
}

function configureSigningWithoutClient() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  vi.stubEnv(
    "TRADESCOUT_PLUGIN_JWT_PRIVATE_KEY",
    privateKey.export({ type: "pkcs8", format: "pem" }).toString()
  );
  vi.stubEnv("TRADESCOUT_PLUGIN_ISSUER", "https://www.thetradescout.com");
  vi.stubEnv("TRADESCOUT_PLUGIN_AUDIENCE", "tradescout-plugin-api");
  vi.stubEnv("TRADESCOUT_PLUGIN_OAUTH_CLIENTS", "[]");
}

function configureValidPluginOAuth() {
  configureSigningWithoutClient();
  vi.stubEnv(
    "TRADESCOUT_PLUGIN_OAUTH_CLIENTS",
    JSON.stringify([
      {
        clientId: "tradescout-test-client",
        name: "TradeScout Test Client",
        redirectUris: ["https://client.example.com/oauth/callback"],
      },
    ])
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("plugin OAuth availability", () => {
  it("is unavailable when the signing contract is absent", () => {
    vi.stubEnv("TRADESCOUT_PLUGIN_JWT_PRIVATE_KEY", "");
    vi.stubEnv("TRADESCOUT_PLUGIN_ISSUER", "");
    vi.stubEnv("TRADESCOUT_PLUGIN_AUDIENCE", "");
    vi.stubEnv("TRADESCOUT_PLUGIN_OAUTH_CLIENTS", "");
    expect(isPluginOAuthConfigured()).toBe(false);
  });

  it("is unavailable for a partial or malformed configuration", () => {
    vi.stubEnv("TRADESCOUT_PLUGIN_JWT_PRIVATE_KEY", "not-a-private-key");
    vi.stubEnv("TRADESCOUT_PLUGIN_ISSUER", "http://thetradescout.com");
    vi.stubEnv("TRADESCOUT_PLUGIN_AUDIENCE", "tradescout-plugin-api");
    vi.stubEnv("TRADESCOUT_PLUGIN_OAUTH_CLIENTS", "not-json");
    expect(isPluginOAuthConfigured()).toBe(false);
  });

  it("is unavailable when signing exists but no OAuth client is registered", () => {
    configureSigningWithoutClient();
    expect(isPluginOAuthConfigured()).toBe(false);
  });

  it("returns a clean, non-cacheable 404 instead of throwing when disabled", async () => {
    vi.stubEnv("TRADESCOUT_PLUGIN_JWT_PRIVATE_KEY", "");
    vi.stubEnv("TRADESCOUT_PLUGIN_ISSUER", "");
    vi.stubEnv("TRADESCOUT_PLUGIN_AUDIENCE", "");
    vi.stubEnv("TRADESCOUT_PLUGIN_OAUTH_CLIENTS", "");

    for (const route of [
      "/.well-known/jwks.json",
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "/oauth/authorize",
    ]) {
      const response = await request(createApp()).get(route);
      expect(response.status, route).toBe(404);
      expect(response.headers["cache-control"], route).toBe("no-store");
      expect(response.body, route).toEqual({ error: "not_found" });
    }
  });

  it("publishes the signing key and metadata only when the full contract is valid", async () => {
    configureValidPluginOAuth();
    expect(isPluginOAuthConfigured()).toBe(true);

    const app = createApp();
    const jwks = await request(app).get("/.well-known/jwks.json");
    expect(jwks.status).toBe(200);
    expect(jwks.body.keys).toHaveLength(1);
    expect(jwks.body.keys[0]).toMatchObject({
      kty: "RSA",
      use: "sig",
      alg: "RS256",
      kid: "tradescout-plugin-v1",
    });
    expect(jwks.body.keys[0].d).toBeUndefined();

    const metadata = await request(app).get("/.well-known/oauth-authorization-server");
    expect(metadata.status).toBe(200);
    expect(metadata.body).toMatchObject({
      issuer: "https://www.thetradescout.com",
      authorization_endpoint: "https://www.thetradescout.com/oauth/authorize",
      token_endpoint: "https://www.thetradescout.com/oauth/token",
      jwks_uri: "https://www.thetradescout.com/.well-known/jwks.json",
    });
  });
});
