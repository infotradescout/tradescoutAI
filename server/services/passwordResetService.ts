import {
  authActionTokenService,
  PASSWORD_RESET_TTL_BOUNDS,
  resolveBoundedTtlMs,
  type AuthActionTokenService,
} from "./authActionTokenService";

export class PasswordResetService {
  constructor(private readonly tokenStore: AuthActionTokenService) {}

  async createToken(userId: string): Promise<{ token: string; code: string; expiresAt: number }> {
    const issued = await this.tokenStore.issue({
      userId,
      purpose: "password_reset",
      ttlMs: resolveBoundedTtlMs(
        process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES,
        PASSWORD_RESET_TTL_BOUNDS
      ),
      includeCode: true,
    });

    if (!issued.code) {
      throw new Error("Password reset token issuance did not return a verification code.");
    }

    return {
      token: issued.token,
      code: issued.code,
      expiresAt: issued.expiresAt.getTime(),
    };
  }

  async createScopedToken(
    userId: string,
    scopeKey: string
  ): Promise<{ token: string; expiresAt: number }> {
    const issued = await this.tokenStore.issueStableScoped({
      userId,
      purpose: "password_reset",
      scopeKey,
      ttlMs: PASSWORD_RESET_TTL_BOUNDS.maxMinutes * 60 * 1000,
    });
    return {
      token: issued.token,
      expiresAt: issued.expiresAt.getTime(),
    };
  }

  async consumeToken(token: string): Promise<string | null> {
    return await this.tokenStore.consumeToken("password_reset", token);
  }

  async resetPassword(token: string, passwordHash: string): Promise<string | null> {
    const normalizedPasswordHash = String(passwordHash || "").trim();
    if (!normalizedPasswordHash) {
      throw new Error("Password hash is required.");
    }

    return await this.tokenStore.consumeTokenWithMutation(
      "password_reset",
      token,
      async (client, userId, consumedAt) => {
        const result = await client.query(
          `
            UPDATE users
            SET password_hash = $2,
                updated_at = $3
            WHERE id = $1
            RETURNING id
          `,
          [userId, normalizedPasswordHash, consumedAt]
        );
        if (Number(result.rowCount || result.rows?.length || 0) !== 1) {
          throw new Error("Password reset user update did not affect exactly one user.");
        }
        return userId;
      }
    );
  }

  async consumeCodeForUser(userId: string, code: string): Promise<boolean> {
    return await this.tokenStore.consumeCodeForUser(userId, "password_reset", code);
  }

  async exchangeCodeForToken(
    userId: string,
    code: string
  ): Promise<{ token: string; expiresAt: number } | null> {
    const issued = await this.tokenStore.exchangeCodeForToken(
      userId,
      "password_reset",
      code,
      resolveBoundedTtlMs(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES, PASSWORD_RESET_TTL_BOUNDS)
    );
    if (!issued) return null;
    return {
      token: issued.token,
      expiresAt: issued.expiresAt.getTime(),
    };
  }

  async revokeActive(userId: string): Promise<number> {
    return await this.tokenStore.revokeActive(userId, "password_reset");
  }
}

export const passwordResetService = new PasswordResetService(authActionTokenService);
