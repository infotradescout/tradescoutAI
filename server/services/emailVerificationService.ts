import { createHash, randomBytes } from "crypto";
import { pool } from "../db";

interface TokenQueryResult {
  rows: Array<{ user_id?: string }>;
}

interface TokenDatabase {
  query(sql: string, values?: unknown[]): Promise<TokenQueryResult>;
}

export class EmailVerificationService {
  private readonly ttlMs: number;

  constructor(
    private readonly tokenDatabase: TokenDatabase = pool as unknown as TokenDatabase,
    ttlMs = (Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES) || 60 * 24) * 60 * 1000
  ) {
    this.ttlMs = ttlMs;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async createToken(userId: string): Promise<{ token: string; expiresAt: number }> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + this.ttlMs;

    await this.tokenDatabase.query(
      `WITH expired AS (
         DELETE FROM public.auth_action_tokens WHERE expires_at <= NOW()
       )
       INSERT INTO public.auth_action_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, 'email_verification', $2, $3)`,
      [userId, this.hashToken(token), new Date(expiresAt)]
    );

    return { token, expiresAt };
  }

  async consumeToken(token: string): Promise<string | null> {
    const result = await this.tokenDatabase.query(
      `WITH selected AS (
         SELECT id
           FROM public.auth_action_tokens
          WHERE purpose = $1
            AND token_hash = $2
            AND expires_at > NOW()
          ORDER BY created_at DESC, id DESC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
       )
       DELETE FROM public.auth_action_tokens token
       USING selected
       WHERE token.id = selected.id
       RETURNING token.user_id`,
      ["email_verification", this.hashToken(token)]
    );

    const userId = result.rows[0]?.user_id;
    return typeof userId === "string" && userId.length > 0 ? userId : null;
  }
}

export const emailVerificationService = new EmailVerificationService();
