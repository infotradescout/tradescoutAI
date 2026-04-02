import { randomBytes, createHash } from "crypto";

interface TokenRecord {
  userId: string;
  expiresAt: number;
}

class PasswordResetService {
  private tokens = new Map<string, TokenRecord>();
  private codesByUser = new Map<string, { codeHash: string; expiresAt: number }>();
  private ttlMs: number;

  constructor() {
    const minutes = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 30;
    this.ttlMs = minutes * 60 * 1000;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private hashCode(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  createToken(userId: string): { token: string; code: string; expiresAt: number } {
    const token = randomBytes(32).toString("hex");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const hashed = this.hashToken(token);
    const expiresAt = Date.now() + this.ttlMs;

    this.tokens.set(hashed, { userId, expiresAt });
    this.codesByUser.set(userId, { codeHash: this.hashCode(code), expiresAt });

    return { token, code, expiresAt };
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

  consumeCodeForUser(userId: string, code: string): boolean {
    const record = this.codesByUser.get(userId);
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      this.codesByUser.delete(userId);
      return false;
    }

    const codeHash = this.hashCode(String(code).trim());
    if (codeHash !== record.codeHash) return false;

    this.codesByUser.delete(userId);
    return true;
  }
}

export const passwordResetService = new PasswordResetService();
