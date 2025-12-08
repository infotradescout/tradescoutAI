import { randomBytes, createHash } from "crypto";

interface TokenRecord {
  userId: string;
  expiresAt: number;
}

class PasswordResetService {
  private tokens = new Map<string, TokenRecord>();
  private ttlMs: number;

  constructor() {
    const minutes = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 30;
    this.ttlMs = minutes * 60 * 1000;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  createToken(userId: string): { token: string; expiresAt: number } {
    const token = randomBytes(32).toString("hex");
    const hashed = this.hashToken(token);
    const expiresAt = Date.now() + this.ttlMs;

    this.tokens.set(hashed, { userId, expiresAt });

    return { token, expiresAt };
  }

  consumeToken(token: string): string | null {
    const hashed = this.hashToken(token);
    const record = this.tokens.get(hashed);

    if (!record) {
      return null;
    }

    if (Date.now() > record.expiresAt) {
      this.tokens.delete(hashed);
      return null;
    }

    this.tokens.delete(hashed);
    return record.userId;
  }
}

export const passwordResetService = new PasswordResetService();
