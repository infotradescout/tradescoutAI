import { createHmac, randomBytes, randomInt } from "node:crypto";
import { pool } from "../db";
import {
  withPoolTransaction,
  type TransactionClient,
  type TransactionPool,
} from "../utils/poolTransaction";

export type AuthActionTokenPurpose = "password_reset" | "email_verification";

type QueryResultLike = {
  rows?: Array<Record<string, unknown>>;
  rowCount?: number | null;
};

export type AuthActionTokenPool = TransactionPool & {
  query: (text: string, values?: unknown[]) => Promise<QueryResultLike>;
};

type AuthActionTokenServiceOptions = {
  dbPool: AuthActionTokenPool;
  hashKey: string;
  now?: () => Date;
  tokenFactory?: () => string;
  codeFactory?: () => string;
};

type IssueAuthActionTokenInput = {
  userId: string;
  purpose: AuthActionTokenPurpose;
  ttlMs: number;
  includeCode?: boolean;
};

type IssueStableScopedAuthActionTokenInput = {
  userId: string;
  purpose: AuthActionTokenPurpose;
  scopeKey: string;
  ttlMs: number;
};

type AuthActionTokenMutation<T> = (
  client: TransactionClient,
  userId: string,
  consumedAt: Date
) => Promise<T>;

export type IssuedAuthActionToken = {
  token: string;
  code?: string;
  expiresAt: Date;
};

export type TtlBounds = {
  defaultMinutes: number;
  minMinutes: number;
  maxMinutes: number;
};

export const PASSWORD_RESET_TTL_BOUNDS: TtlBounds = {
  defaultMinutes: 30,
  minMinutes: 5,
  maxMinutes: 60,
};

export const EMAIL_VERIFICATION_TTL_BOUNDS: TtlBounds = {
  defaultMinutes: 24 * 60,
  minMinutes: 15,
  maxMinutes: 7 * 24 * 60,
};

const AUTH_ACTION_TOKEN_TABLE = "auth_action_tokens";

function requireNonEmpty(value: string, label: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizePositiveTtlMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Auth action token TTL must be a positive finite number.");
  }
  return Math.trunc(value);
}

function boundTtlMsForPurpose(purpose: AuthActionTokenPurpose, requestedTtlMs: number): number {
  const normalized = normalizePositiveTtlMs(requestedTtlMs);
  const bounds =
    purpose === "password_reset" ? PASSWORD_RESET_TTL_BOUNDS : EMAIL_VERIFICATION_TTL_BOUNDS;
  return Math.min(
    bounds.maxMinutes * 60 * 1000,
    Math.max(bounds.minMinutes * 60 * 1000, normalized)
  );
}

function resolveRuntimeHashKey(): string {
  const configured =
    String(process.env.AUTH_ACTION_TOKEN_HASH_KEY || "").trim() ||
    String(process.env.SESSION_SECRET || "").trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_ACTION_TOKEN_HASH_KEY or SESSION_SECRET is required for persistent auth action tokens."
    );
  }

  // Tests and local deterministic lanes may import the service without an app
  // runtime. Production is explicitly fail-closed above.
  return "tradescout-local-auth-action-token-hash-key";
}

export function resolveBoundedTtlMs(
  rawMinutes: string | number | undefined,
  bounds: TtlBounds
): number {
  const parsed = Number(rawMinutes);
  const requestedMinutes = Number.isFinite(parsed) && parsed > 0 ? parsed : bounds.defaultMinutes;
  const boundedMinutes = Math.min(
    bounds.maxMinutes,
    Math.max(bounds.minMinutes, Math.trunc(requestedMinutes))
  );
  return boundedMinutes * 60 * 1000;
}

export class AuthActionTokenService {
  private readonly dbPool: AuthActionTokenPool;
  private readonly hashKey: string;
  private readonly now: () => Date;
  private readonly tokenFactory: () => string;
  private readonly codeFactory: () => string;

  constructor(options: AuthActionTokenServiceOptions) {
    this.dbPool = options.dbPool;
    this.hashKey = requireNonEmpty(options.hashKey, "Auth action token hash key");
    this.now = options.now || (() => new Date());
    this.tokenFactory = options.tokenFactory || (() => randomBytes(32).toString("hex"));
    this.codeFactory = options.codeFactory || (() => String(randomInt(100_000, 1_000_000)));
  }

  private hashSecret(
    purpose: AuthActionTokenPurpose,
    kind: "token" | "code",
    secret: string,
    userId?: string
  ): string {
    const identityScope = kind === "code" ? requireNonEmpty(userId || "", "User id") : "";
    return createHmac("sha256", this.hashKey)
      .update(`auth-action:v1\0${purpose}\0${kind}\0${identityScope}\0${secret}`)
      .digest("hex");
  }

  private deriveScopedToken(
    purpose: AuthActionTokenPurpose,
    userId: string,
    scopeKey: string
  ): string {
    return createHmac("sha256", this.hashKey)
      .update(`auth-action-scoped:v1\0${purpose}\0${userId}\0${scopeKey}`)
      .digest("base64url");
  }

  private async lockUser(client: TransactionClient, userId: string): Promise<void> {
    const result = await client.query(
      `
        SELECT id
        FROM users
        WHERE id = $1
        FOR UPDATE
      `,
      [userId]
    );
    if (Number(result.rowCount || result.rows?.length || 0) !== 1) {
      throw new Error("Cannot authorize an auth action for an unknown user.");
    }
  }

  private async consumeTokenOnClient(
    client: TransactionClient,
    purpose: AuthActionTokenPurpose,
    tokenHash: string,
    consumedAt: Date
  ): Promise<string | null> {
    const result = await client.query(
      `
        UPDATE ${AUTH_ACTION_TOKEN_TABLE}
        SET consumed_at = $3
        WHERE token_hash = $1
          AND purpose = $2
          AND consumed_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > $3
        RETURNING user_id
      `,
      [tokenHash, purpose, consumedAt]
    );

    const userId = result.rows?.[0]?.user_id;
    return typeof userId === "string" && userId ? userId : null;
  }

  private async consumeCodeOnClient(
    client: TransactionClient,
    userId: string,
    purpose: AuthActionTokenPurpose,
    codeHash: string,
    consumedAt: Date
  ): Promise<boolean> {
    const result = await client.query(
      `
        UPDATE ${AUTH_ACTION_TOKEN_TABLE}
        SET consumed_at = $4
        WHERE user_id = $1
          AND purpose = $2
          AND code_hash = $3
          AND consumed_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > $4
        RETURNING user_id
      `,
      [userId, purpose, codeHash, consumedAt]
    );

    return typeof result.rows?.[0]?.user_id === "string";
  }

  async issue(input: IssueAuthActionTokenInput): Promise<IssuedAuthActionToken> {
    const userId = requireNonEmpty(input.userId, "User id");
    const ttlMs = boundTtlMsForPurpose(input.purpose, input.ttlMs);
    const issuedAt = this.now();
    const expiresAt = new Date(issuedAt.getTime() + ttlMs);
    const token = requireNonEmpty(this.tokenFactory(), "Generated auth action token");
    const code = input.includeCode
      ? requireNonEmpty(this.codeFactory(), "Generated auth action code")
      : undefined;
    const tokenHash = this.hashSecret(input.purpose, "token", token);
    const codeHash = code ? this.hashSecret(input.purpose, "code", code, userId) : null;

    await withPoolTransaction(this.dbPool, async (client) => {
      // The user row is the cross-instance mutex for issue/revoke operations.
      // It also guarantees the token cannot outlive a concurrently deleted user.
      await this.lockUser(client, userId);
      await client.query(
        `
          UPDATE ${AUTH_ACTION_TOKEN_TABLE}
          SET revoked_at = $3
          WHERE user_id = $1
            AND purpose = $2
            AND scope_key IS NULL
            AND consumed_at IS NULL
            AND revoked_at IS NULL
        `,
        [userId, input.purpose, issuedAt]
      );
      await client.query(
        `
          INSERT INTO ${AUTH_ACTION_TOKEN_TABLE} (
            user_id,
            purpose,
            scope_key,
            token_hash,
            code_hash,
            expires_at,
            created_at
          )
          VALUES ($1, $2, NULL, $3, $4, $5, $6)
        `,
        [userId, input.purpose, tokenHash, codeHash, expiresAt, issuedAt]
      );
    });

    return { token, ...(code ? { code } : {}), expiresAt };
  }

  async issueStableScoped(
    input: IssueStableScopedAuthActionTokenInput
  ): Promise<IssuedAuthActionToken> {
    const userId = requireNonEmpty(input.userId, "User id");
    const scopeKey = requireNonEmpty(input.scopeKey, "Auth action token scope");
    const ttlMs = boundTtlMsForPurpose(input.purpose, input.ttlMs);
    const issuedAt = this.now();
    const expiresAt = new Date(issuedAt.getTime() + ttlMs);
    const token = this.deriveScopedToken(input.purpose, userId, scopeKey);
    const tokenHash = this.hashSecret(input.purpose, "token", token);

    return await withPoolTransaction(this.dbPool, async (client) => {
      await this.lockUser(client, userId);
      const existing = await client.query(
        `
          SELECT expires_at, consumed_at, revoked_at
          FROM ${AUTH_ACTION_TOKEN_TABLE}
          WHERE user_id = $1
            AND purpose = $2
            AND scope_key = $3
            AND token_hash = $4
          LIMIT 1
        `,
        [userId, input.purpose, scopeKey, tokenHash]
      );
      const existingRow = existing.rows?.[0];
      if (existingRow) {
        const existingExpiresAt = new Date(String(existingRow.expires_at || ""));
        if (
          existingRow.consumed_at == null &&
          existingRow.revoked_at == null &&
          Number.isFinite(existingExpiresAt.getTime()) &&
          existingExpiresAt > issuedAt
        ) {
          return { token, expiresAt: existingExpiresAt };
        }
        throw new Error("Scoped auth action token is no longer active.");
      }

      await client.query(
        `
          INSERT INTO ${AUTH_ACTION_TOKEN_TABLE} (
            user_id,
            purpose,
            scope_key,
            token_hash,
            code_hash,
            expires_at,
            created_at
          )
          VALUES ($1, $2, $3, $4, NULL, $5, $6)
        `,
        [userId, input.purpose, scopeKey, tokenHash, expiresAt, issuedAt]
      );
      return { token, expiresAt };
    });
  }

  async consumeToken(purpose: AuthActionTokenPurpose, tokenValue: string): Promise<string | null> {
    return await this.consumeTokenWithMutation(
      purpose,
      tokenValue,
      async (_client, userId) => userId
    );
  }

  async consumeTokenWithMutation<T>(
    purpose: AuthActionTokenPurpose,
    tokenValue: string,
    mutation: AuthActionTokenMutation<T>
  ): Promise<T | null> {
    const token = String(tokenValue || "").trim();
    if (!token) return null;

    const consumedAt = this.now();
    const tokenHash = this.hashSecret(purpose, "token", token);

    return await withPoolTransaction(this.dbPool, async (client) => {
      // Resolve the identity without taking a token-row lock, then serialize all
      // issue/revoke/consume operations for that identity on the user row. The
      // guarded UPDATE below remains the single-use winner across instances.
      const candidate = await client.query(
        `
          SELECT user_id
          FROM ${AUTH_ACTION_TOKEN_TABLE}
          WHERE token_hash = $1
            AND purpose = $2
            AND consumed_at IS NULL
            AND revoked_at IS NULL
            AND expires_at > $3
          LIMIT 1
        `,
        [tokenHash, purpose, consumedAt]
      );
      const candidateUserId = candidate.rows?.[0]?.user_id;
      if (typeof candidateUserId !== "string" || !candidateUserId) return null;

      await this.lockUser(client, candidateUserId);
      const userId = await this.consumeTokenOnClient(client, purpose, tokenHash, consumedAt);
      if (!userId) return null;

      return await mutation(client, userId, consumedAt);
    });
  }

  async consumeCodeForUser(
    userIdValue: string,
    purpose: AuthActionTokenPurpose,
    codeValue: string
  ): Promise<boolean> {
    const result = await this.consumeCodeForUserWithMutation(
      userIdValue,
      purpose,
      codeValue,
      async () => true
    );
    return result === true;
  }

  async consumeCodeForUserWithMutation<T>(
    userIdValue: string,
    purpose: AuthActionTokenPurpose,
    codeValue: string,
    mutation: AuthActionTokenMutation<T>
  ): Promise<T | null> {
    const userId = String(userIdValue || "").trim();
    const code = String(codeValue || "").trim();
    if (!userId || !code) return null;

    const consumedAt = this.now();
    const codeHash = this.hashSecret(purpose, "code", code, userId);

    return await withPoolTransaction(this.dbPool, async (client) => {
      await this.lockUser(client, userId);
      const consumed = await this.consumeCodeOnClient(
        client,
        userId,
        purpose,
        codeHash,
        consumedAt
      );
      if (!consumed) return null;

      return await mutation(client, userId, consumedAt);
    });
  }

  async exchangeCodeForToken(
    userIdValue: string,
    purpose: AuthActionTokenPurpose,
    codeValue: string,
    ttlMsValue: number
  ): Promise<IssuedAuthActionToken | null> {
    const userId = String(userIdValue || "").trim();
    const code = String(codeValue || "").trim();
    if (!userId || !code) return null;

    const ttlMs = boundTtlMsForPurpose(purpose, ttlMsValue);
    const issuedAt = this.now();
    const expiresAt = new Date(issuedAt.getTime() + ttlMs);
    const token = requireNonEmpty(this.tokenFactory(), "Generated auth action token");
    const tokenHash = this.hashSecret(purpose, "token", token);
    const codeHash = this.hashSecret(purpose, "code", code, userId);

    return await withPoolTransaction(this.dbPool, async (client) => {
      await this.lockUser(client, userId);
      const consumed = await this.consumeCodeOnClient(client, userId, purpose, codeHash, issuedAt);
      if (!consumed) return null;

      await client.query(
        `
          INSERT INTO ${AUTH_ACTION_TOKEN_TABLE} (
            user_id,
            purpose,
            scope_key,
            token_hash,
            code_hash,
            expires_at,
            created_at
          )
          VALUES ($1, $2, NULL, $3, NULL, $4, $5)
        `,
        [userId, purpose, tokenHash, expiresAt, issuedAt]
      );

      return { token, expiresAt };
    });
  }

  async revokeActive(userIdValue: string, purpose: AuthActionTokenPurpose): Promise<number> {
    const userId = requireNonEmpty(userIdValue, "User id");
    const revokedAt = this.now();

    return await withPoolTransaction(this.dbPool, async (client) => {
      await this.lockUser(client, userId);
      const result = await client.query(
        `
          UPDATE ${AUTH_ACTION_TOKEN_TABLE}
          SET revoked_at = $3
          WHERE user_id = $1
            AND purpose = $2
            AND consumed_at IS NULL
            AND revoked_at IS NULL
        `,
        [userId, purpose, revokedAt]
      );
      return Number(result.rowCount || 0);
    });
  }
}

export const authActionTokenService = new AuthActionTokenService({
  dbPool: pool as unknown as AuthActionTokenPool,
  hashKey: resolveRuntimeHashKey(),
});
