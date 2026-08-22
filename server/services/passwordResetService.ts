import { createHash, randomBytes } from "crypto";
import { pool } from "../db";

interface TokenQueryResult {
  rows: Array<{ user_id?: string }>;
}

interface TokenDatabase {
  query(sql: string, values?: unknown[]): Promise<TokenQueryResult>;
}

export class PasswordResetService {
  private readonly ttlMs: number;

  constructor(
    private readonly tokenDatabase: TokenDatabase = pool as unknown as TokenDatabase,
    ttlMs = (Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 30) * 60 * 1000
  ) {
    this.ttlMs = ttlMs;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private hashCode(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  async createToken(userId: string): Promise<{ token: string; code: string; expiresAt: number }> {
    const token = randomBytes(32).toString("hex");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + this.ttlMs;

    await this.tokenDatabase.query(
      `WITH expired AS (
         DELETE FROM public.auth_action_tokens WHERE expires_at <= NOW()
       ), link_insert AS (
         INSERT INTO public.auth_action_tokens (user_id, purpose, token_hash, expires_at)
         VALUES ($1, 'password_reset', $2, $4)
         RETURNING id
       )
       INSERT INTO public.auth_action_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, 'password_reset_code', $3, $4)
       ON CONFLICT (user_id) WHERE purpose = 'password_reset_code'
       DO UPDATE SET
         token_hash = EXCLUDED.token_hash,
         expires_at = EXCLUDED.expires_at,
         created_at = NOW()`,
      [userId, this.hashToken(token), this.hashCode(code), new Date(expiresAt)]
    );

    return { token, code, expiresAt };
  }

  async consumeToken(token: string): Promise<string | null> {
    return this.consume("password_reset", this.hashToken(token));
  }

  async consumeCodeForUser(userId: string, code: string): Promise<boolean> {
    const consumedUserId = await this.consume(
      "password_reset_code",
      this.hashCode(String(code).trim()),
      userId
    );
    return consumedUserId === userId;
  }

  private async consume(
    purpose: "password_reset" | "password_reset_code",
    tokenHash: string,
    userId?: string
  ): Promise<string | null> {
    const result = await this.tokenDatabase.query(
      `WITH selected AS (
         SELECT id
           FROM public.auth_action_tokens
          WHERE purpose = $1
            AND token_hash = $2
            AND expires_at > NOW()
            AND ($3::varchar IS NULL OR user_id = $3)
          ORDER BY created_at DESC, id DESC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
       )
       DELETE FROM public.auth_action_tokens token
       USING selected
       WHERE token.id = selected.id
       RETURNING token.user_id`,
      [purpose, tokenHash, userId || null]
    );

    const consumedUserId = result.rows[0]?.user_id;
    return typeof consumedUserId === "string" && consumedUserId.length > 0 ? consumedUserId : null;
  }
}

export const passwordResetService = new PasswordResetService();
