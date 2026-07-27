import {
  authActionTokenService,
  EMAIL_VERIFICATION_TTL_BOUNDS,
  resolveBoundedTtlMs,
  type AuthActionTokenService,
} from "./authActionTokenService";

export class EmailVerificationService {
  constructor(private readonly tokenStore: AuthActionTokenService) {}

  async createToken(userId: string): Promise<{ token: string; expiresAt: number }> {
    const issued = await this.tokenStore.issue({
      userId,
      purpose: "email_verification",
      ttlMs: resolveBoundedTtlMs(
        process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,
        EMAIL_VERIFICATION_TTL_BOUNDS
      ),
    });
    return {
      token: issued.token,
      expiresAt: issued.expiresAt.getTime(),
    };
  }

  async createScopedToken(
    userId: string,
    scopeKey: string
  ): Promise<{ token: string; expiresAt: number }> {
    const issued = await this.tokenStore.issueStableScoped({
      userId,
      purpose: "email_verification",
      scopeKey,
      ttlMs: EMAIL_VERIFICATION_TTL_BOUNDS.maxMinutes * 60 * 1000,
    });
    return {
      token: issued.token,
      expiresAt: issued.expiresAt.getTime(),
    };
  }

  async consumeToken(token: string): Promise<string | null> {
    return await this.tokenStore.consumeToken("email_verification", token);
  }

  async verifyEmail(token: string): Promise<string | null> {
    return await this.tokenStore.consumeTokenWithMutation(
      "email_verification",
      token,
      async (client, userId, consumedAt) => {
        const result = await client.query(
          `
            UPDATE users
            SET email_verified = TRUE,
                updated_at = $2
            WHERE id = $1
            RETURNING id
          `,
          [userId, consumedAt]
        );
        if (Number(result.rowCount || result.rows?.length || 0) !== 1) {
          throw new Error("Email verification user update did not affect exactly one user.");
        }
        return userId;
      }
    );
  }

  async revokeActive(userId: string): Promise<number> {
    return await this.tokenStore.revokeActive(userId, "email_verification");
  }
}

export const emailVerificationService = new EmailVerificationService(authActionTokenService);
