import { describe, expect, it } from "vitest";
import {
  AuthActionTokenService,
  EMAIL_VERIFICATION_TTL_BOUNDS,
  PASSWORD_RESET_TTL_BOUNDS,
  resolveBoundedTtlMs,
} from "../services/authActionTokenService";
import { EmailVerificationService } from "../services/emailVerificationService";
import { PasswordResetService } from "../services/passwordResetService";

type StoredToken = {
  userId: string;
  purpose: string;
  scopeKey: string | null;
  tokenHash: string;
  codeHash: string | null;
  expiresAt: Date;
  createdAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
};

type RecordedQuery = {
  sql: string;
  values: any[];
};

class MemoryAuthActionTokenPool {
  readonly rows: StoredToken[] = [];
  readonly queries: RecordedQuery[] = [];
  readonly users = new Map<
    string,
    { emailVerified: boolean; passwordHash: string | null; updatedAt: Date | null }
  >();
  failNextUserUpdate = false;
  failNextTokenInsert = false;

  async connect() {
    let snapshot:
      | {
          rows: StoredToken[];
          users: Array<
            [
              string,
              { emailVerified: boolean; passwordHash: string | null; updatedAt: Date | null },
            ]
          >;
        }
      | undefined;

    return {
      query: async (text: string, values?: any[]) => {
        const sql = text.replace(/\s+/g, " ").trim();
        if (sql === "BEGIN") {
          snapshot = {
            rows: this.rows.map((row) => ({ ...row })),
            users: Array.from(this.users.entries()).map(([id, user]) => [id, { ...user }]),
          };
        }

        const result = await this.query(text, values);

        if (sql === "COMMIT") {
          snapshot = undefined;
        } else if (sql === "ROLLBACK" && snapshot) {
          this.rows.splice(0, this.rows.length, ...snapshot.rows.map((row) => ({ ...row })));
          this.users.clear();
          for (const [id, user] of snapshot.users) {
            this.users.set(id, { ...user });
          }
          snapshot = undefined;
        }

        return result;
      },
      release: () => {},
    };
  }

  async query(text: string, values: any[] = []) {
    const sql = text.replace(/\s+/g, " ").trim();
    this.queries.push({ sql, values });

    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
      return { rows: [], rowCount: null };
    }

    if (/SELECT id FROM users WHERE id = \$1 FOR UPDATE/i.test(sql)) {
      if (!this.users.has(String(values[0]))) {
        this.users.set(String(values[0]), {
          emailVerified: false,
          passwordHash: null,
          updatedAt: null,
        });
      }
      return { rows: [{ id: values[0] }], rowCount: 1 };
    }

    if (/SELECT user_id FROM auth_action_tokens/i.test(sql) && /token_hash = \$1/i.test(sql)) {
      const checkedAt = values[2] as Date;
      const row = this.rows.find(
        (candidate) =>
          candidate.tokenHash === values[0] &&
          candidate.purpose === values[1] &&
          candidate.consumedAt === null &&
          candidate.revokedAt === null &&
          candidate.expiresAt.getTime() > checkedAt.getTime()
      );
      return row ? { rows: [{ user_id: row.userId }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    if (
      /SELECT expires_at, consumed_at, revoked_at FROM auth_action_tokens/i.test(sql) &&
      /scope_key = \$3/i.test(sql)
    ) {
      const row = this.rows.find(
        (candidate) =>
          candidate.userId === values[0] &&
          candidate.purpose === values[1] &&
          candidate.scopeKey === values[2] &&
          candidate.tokenHash === values[3]
      );
      return row
        ? {
            rows: [
              {
                expires_at: row.expiresAt,
                consumed_at: row.consumedAt,
                revoked_at: row.revokedAt,
              },
            ],
            rowCount: 1,
          }
        : { rows: [], rowCount: 0 };
    }

    if (/SET revoked_at = \$3/i.test(sql)) {
      let changed = 0;
      for (const row of this.rows) {
        if (
          row.userId === values[0] &&
          row.purpose === values[1] &&
          (!/scope_key IS NULL/i.test(sql) || row.scopeKey === null) &&
          row.consumedAt === null &&
          row.revokedAt === null
        ) {
          row.revokedAt = values[2];
          changed += 1;
        }
      }
      return { rows: [], rowCount: changed };
    }

    if (/INSERT INTO auth_action_tokens/i.test(sql)) {
      if (this.failNextTokenInsert) {
        this.failNextTokenInsert = false;
        throw new Error("simulated token insert failure");
      }
      const stableScoped = /VALUES \(\$1, \$2, \$3, \$4, NULL, \$5, \$6\)/i.test(sql);
      const exchangesCodeForToken = /VALUES \(\$1, \$2, NULL, \$3, NULL, \$4, \$5\)/i.test(sql);
      this.rows.push({
        userId: values[0],
        purpose: values[1],
        scopeKey: stableScoped ? values[2] : null,
        tokenHash: stableScoped ? values[3] : values[2],
        codeHash: stableScoped || exchangesCodeForToken ? null : values[3],
        expiresAt: stableScoped ? values[4] : exchangesCodeForToken ? values[3] : values[4],
        createdAt: stableScoped ? values[5] : exchangesCodeForToken ? values[4] : values[5],
        consumedAt: null,
        revokedAt: null,
      });
      return { rows: [], rowCount: 1 };
    }

    if (/SET consumed_at = \$3/i.test(sql) && /token_hash = \$1/i.test(sql)) {
      const consumedAt = values[2] as Date;
      const row = this.rows.find(
        (candidate) =>
          candidate.tokenHash === values[0] &&
          candidate.purpose === values[1] &&
          candidate.consumedAt === null &&
          candidate.revokedAt === null &&
          candidate.expiresAt.getTime() > consumedAt.getTime()
      );
      if (!row) return { rows: [], rowCount: 0 };
      row.consumedAt = consumedAt;
      return { rows: [{ user_id: row.userId }], rowCount: 1 };
    }

    if (/UPDATE users SET email_verified = TRUE/i.test(sql)) {
      if (this.failNextUserUpdate) {
        this.failNextUserUpdate = false;
        throw new Error("simulated user update failure");
      }
      const user = this.users.get(String(values[0]));
      if (!user) return { rows: [], rowCount: 0 };
      user.emailVerified = true;
      user.updatedAt = values[1];
      return { rows: [{ id: values[0] }], rowCount: 1 };
    }

    if (/UPDATE users SET password_hash = \$2/i.test(sql)) {
      if (this.failNextUserUpdate) {
        this.failNextUserUpdate = false;
        throw new Error("simulated user update failure");
      }
      const user = this.users.get(String(values[0]));
      if (!user) return { rows: [], rowCount: 0 };
      user.passwordHash = values[1];
      user.updatedAt = values[2];
      return { rows: [{ id: values[0] }], rowCount: 1 };
    }

    if (/SET consumed_at = \$4/i.test(sql) && /code_hash = \$3/i.test(sql)) {
      const consumedAt = values[3] as Date;
      const row = this.rows.find(
        (candidate) =>
          candidate.userId === values[0] &&
          candidate.purpose === values[1] &&
          candidate.codeHash === values[2] &&
          candidate.consumedAt === null &&
          candidate.revokedAt === null &&
          candidate.expiresAt.getTime() > consumedAt.getTime()
      );
      if (!row) return { rows: [], rowCount: 0 };
      row.consumedAt = consumedAt;
      return { rows: [{ user_id: row.userId }], rowCount: 1 };
    }

    throw new Error(`Unexpected auth action token test query: ${sql}`);
  }
}

describe("persistent auth action token service", () => {
  it("persists only hashes and revokes the prior active same-purpose credential", async () => {
    const dbPool = new MemoryAuthActionTokenPool();
    const tokens = ["first-raw-token", "second-raw-token"];
    const codes = ["123456", "654321"];
    const nowMs = Date.UTC(2026, 6, 26, 12, 0, 0);
    const service = new AuthActionTokenService({
      dbPool,
      hashKey: "focused-test-hash-key",
      now: () => new Date(nowMs),
      tokenFactory: () => String(tokens.shift()),
      codeFactory: () => String(codes.shift()),
    });

    const first = await service.issue({
      userId: "user-1",
      purpose: "password_reset",
      ttlMs: 30 * 60 * 1000,
      includeCode: true,
    });
    const second = await service.issue({
      userId: "user-1",
      purpose: "password_reset",
      ttlMs: 30 * 60 * 1000,
      includeCode: true,
    });

    expect(first).toMatchObject({ token: "first-raw-token", code: "123456" });
    expect(second).toMatchObject({ token: "second-raw-token", code: "654321" });
    expect(dbPool.rows).toHaveLength(2);
    expect(dbPool.rows[0].revokedAt).toEqual(new Date(nowMs));
    expect(dbPool.rows[1].revokedAt).toBeNull();

    const persistedValues = dbPool.rows.flatMap((row) => [row.tokenHash, row.codeHash]);
    expect(persistedValues).not.toContain("first-raw-token");
    expect(persistedValues).not.toContain("second-raw-token");
    expect(persistedValues).not.toContain("123456");
    expect(persistedValues).not.toContain("654321");
    expect(dbPool.rows.every((row) => row.tokenHash.length === 64)).toBe(true);
    expect(dbPool.rows.every((row) => row.codeHash?.length === 64)).toBe(true);

    await expect(service.consumeToken("password_reset", first.token)).resolves.toBeNull();
    await expect(service.consumeCodeForUser("user-1", "password_reset", "123456")).resolves.toBe(
      false
    );
  });

  it("allows exactly one atomic consume winner and invalidates the paired code", async () => {
    const dbPool = new MemoryAuthActionTokenPool();
    const nowMs = Date.UTC(2026, 6, 26, 12, 0, 0);
    const service = new AuthActionTokenService({
      dbPool,
      hashKey: "focused-test-hash-key",
      now: () => new Date(nowMs),
      tokenFactory: () => "single-use-token",
      codeFactory: () => "246810",
    });
    const issued = await service.issue({
      userId: "user-atomic",
      purpose: "password_reset",
      ttlMs: 30 * 60 * 1000,
      includeCode: true,
    });

    const results = await Promise.all([
      service.consumeToken("password_reset", issued.token),
      service.consumeToken("password_reset", issued.token),
    ]);

    expect(results.filter((value) => value === "user-atomic")).toHaveLength(1);
    expect(results.filter((value) => value === null)).toHaveLength(1);
    await expect(
      service.consumeCodeForUser("user-atomic", "password_reset", "246810")
    ).resolves.toBe(false);

    const consumeSql = dbPool.queries
      .map((query) => query.sql)
      .find((sql) => /UPDATE auth_action_tokens/i.test(sql) && /token_hash = \$1/i.test(sql));
    expect(consumeSql).toContain("UPDATE auth_action_tokens");
    expect(consumeSql).toContain("consumed_at IS NULL");
    expect(consumeSql).toContain("revoked_at IS NULL");
    expect(consumeSql).toContain("expires_at > $3");
    expect(consumeSql).toContain("RETURNING user_id");
  });

  it("reuses one delivery-scoped token without revoking unrelated user credentials", async () => {
    const dbPool = new MemoryAuthActionTokenPool();
    const nowMs = Date.UTC(2026, 6, 26, 12, 0, 0);
    const service = new AuthActionTokenService({
      dbPool,
      hashKey: "focused-test-hash-key",
      now: () => new Date(nowMs),
      tokenFactory: () => "unrelated-user-requested-token",
      codeFactory: () => "112244",
    });
    const unrelated = await service.issue({
      userId: "user-scoped",
      purpose: "password_reset",
      ttlMs: 30 * 60 * 1000,
      includeCode: true,
    });
    const firstScoped = await service.issueStableScoped({
      userId: "user-scoped",
      purpose: "password_reset",
      scopeKey: "notification-delivery:intent-1",
      ttlMs: 60 * 60 * 1000,
    });
    const retryScoped = await service.issueStableScoped({
      userId: "user-scoped",
      purpose: "password_reset",
      scopeKey: "notification-delivery:intent-1",
      ttlMs: 60 * 60 * 1000,
    });

    expect(retryScoped.token).toBe(firstScoped.token);
    expect(dbPool.rows).toHaveLength(2);
    expect(dbPool.rows.find((row) => row.scopeKey === null)?.revokedAt).toBeNull();
    expect(
      dbPool.rows.find((row) => row.scopeKey === "notification-delivery:intent-1")?.revokedAt
    ).toBeNull();
    await expect(service.consumeToken("password_reset", unrelated.token)).resolves.toBe(
      "user-scoped"
    );
    await expect(service.consumeToken("password_reset", firstScoped.token)).resolves.toBe(
      "user-scoped"
    );
  });

  it("atomically consumes a reset code and invalidates its paired link", async () => {
    const dbPool = new MemoryAuthActionTokenPool();
    const nowMs = Date.UTC(2026, 6, 26, 12, 0, 0);
    const service = new AuthActionTokenService({
      dbPool,
      hashKey: "focused-test-hash-key",
      now: () => new Date(nowMs),
      tokenFactory: () => "code-paired-token",
      codeFactory: () => "135790",
    });
    const issued = await service.issue({
      userId: "user-code",
      purpose: "password_reset",
      ttlMs: 30 * 60 * 1000,
      includeCode: true,
    });

    await expect(service.consumeCodeForUser("user-code", "password_reset", "135790")).resolves.toBe(
      true
    );
    await expect(service.consumeCodeForUser("user-code", "password_reset", "135790")).resolves.toBe(
      false
    );
    await expect(service.consumeToken("password_reset", issued.token)).resolves.toBeNull();

    const consumeSql = dbPool.queries
      .map((query) => query.sql)
      .find((sql) => /code_hash = \$3/i.test(sql));
    expect(consumeSql).toContain("UPDATE auth_action_tokens");
    expect(consumeSql).toContain("consumed_at IS NULL");
    expect(consumeSql).toContain("revoked_at IS NULL");
    expect(consumeSql).toContain("expires_at > $4");
    expect(consumeSql).toContain("RETURNING user_id");
  });

  it("rolls back email-token consumption when the protected user update fails", async () => {
    const dbPool = new MemoryAuthActionTokenPool();
    const nowMs = Date.UTC(2026, 6, 26, 12, 0, 0);
    const tokenStore = new AuthActionTokenService({
      dbPool,
      hashKey: "focused-test-hash-key",
      now: () => new Date(nowMs),
      tokenFactory: () => "email-verification-raw-token",
    });
    const service = new EmailVerificationService(tokenStore);
    const issued = await service.createToken("user-email-atomic");

    dbPool.failNextUserUpdate = true;
    await expect(service.verifyEmail(issued.token)).rejects.toThrow(
      "simulated user update failure"
    );
    expect(dbPool.users.get("user-email-atomic")?.emailVerified).toBe(false);

    await expect(service.verifyEmail(issued.token)).resolves.toBe("user-email-atomic");
    expect(dbPool.users.get("user-email-atomic")?.emailVerified).toBe(true);
    await expect(service.verifyEmail(issued.token)).resolves.toBeNull();

    expect(dbPool.queries.filter(({ sql }) => sql === "ROLLBACK")).toHaveLength(1);
    expect(dbPool.rows[0]?.consumedAt).toEqual(new Date(nowMs));
  });

  it("rolls back reset-token consumption when the password update fails", async () => {
    const dbPool = new MemoryAuthActionTokenPool();
    const nowMs = Date.UTC(2026, 6, 26, 12, 0, 0);
    const tokenStore = new AuthActionTokenService({
      dbPool,
      hashKey: "focused-test-hash-key",
      now: () => new Date(nowMs),
      tokenFactory: () => "password-reset-raw-token",
      codeFactory: () => "975310",
    });
    const service = new PasswordResetService(tokenStore);
    const issued = await service.createToken("user-password-atomic");

    dbPool.failNextUserUpdate = true;
    await expect(service.resetPassword(issued.token, "first-password-hash")).rejects.toThrow(
      "simulated user update failure"
    );
    expect(dbPool.users.get("user-password-atomic")?.passwordHash).toBeNull();

    await expect(service.resetPassword(issued.token, "committed-password-hash")).resolves.toBe(
      "user-password-atomic"
    );
    expect(dbPool.users.get("user-password-atomic")?.passwordHash).toBe("committed-password-hash");
    await expect(service.resetPassword(issued.token, "replay-password-hash")).resolves.toBeNull();

    expect(dbPool.queries.filter(({ sql }) => sql === "ROLLBACK")).toHaveLength(1);
    expect(dbPool.users.get("user-password-atomic")?.passwordHash).not.toBe("replay-password-hash");
  });

  it("rolls back code consumption when replacement-token issuance fails", async () => {
    const dbPool = new MemoryAuthActionTokenPool();
    const rawTokens = [
      "original-code-paired-token",
      "failed-replacement-token",
      "successful-replacement-token",
      "unused-invalid-code-token",
    ];
    const nowMs = Date.UTC(2026, 6, 26, 12, 0, 0);
    const tokenStore = new AuthActionTokenService({
      dbPool,
      hashKey: "focused-test-hash-key",
      now: () => new Date(nowMs),
      tokenFactory: () => String(rawTokens.shift()),
      codeFactory: () => "864209",
    });
    const service = new PasswordResetService(tokenStore);
    const original = await service.createToken("user-code-exchange");

    dbPool.failNextTokenInsert = true;
    await expect(service.exchangeCodeForToken("user-code-exchange", original.code)).rejects.toThrow(
      "simulated token insert failure"
    );

    const exchanged = await service.exchangeCodeForToken("user-code-exchange", original.code);
    expect(exchanged?.token).toBe("successful-replacement-token");
    await expect(
      service.exchangeCodeForToken("user-code-exchange", original.code)
    ).resolves.toBeNull();
    await expect(service.consumeToken(original.token)).resolves.toBeNull();
    await expect(
      service.resetPassword(String(exchanged?.token), "exchanged-password-hash")
    ).resolves.toBe("user-code-exchange");
    await expect(
      service.resetPassword(String(exchanged?.token), "replay-password-hash")
    ).resolves.toBeNull();

    const persistedValues = dbPool.rows.flatMap((row) => [row.tokenHash, row.codeHash]);
    expect(persistedValues).not.toContain("original-code-paired-token");
    expect(persistedValues).not.toContain("failed-replacement-token");
    expect(persistedValues).not.toContain("successful-replacement-token");
    expect(persistedValues).not.toContain("864209");
    expect(dbPool.queries.filter(({ sql }) => sql === "ROLLBACK")).toHaveLength(1);
  });

  it("rejects expired credentials and clamps configured lifetimes", async () => {
    const dbPool = new MemoryAuthActionTokenPool();
    let nowMs = Date.UTC(2026, 6, 26, 12, 0, 0);
    const service = new AuthActionTokenService({
      dbPool,
      hashKey: "focused-test-hash-key",
      now: () => new Date(nowMs),
      tokenFactory: () => "expiring-token",
      codeFactory: () => "112233",
    });
    const issued = await service.issue({
      userId: "user-expired",
      purpose: "email_verification",
      ttlMs: 15 * 60 * 1000,
    });

    nowMs += 15 * 60 * 1000 + 1;
    await expect(service.consumeToken("email_verification", issued.token)).resolves.toBeNull();

    expect(resolveBoundedTtlMs("1", PASSWORD_RESET_TTL_BOUNDS)).toBe(5 * 60 * 1000);
    expect(resolveBoundedTtlMs("9999", PASSWORD_RESET_TTL_BOUNDS)).toBe(60 * 60 * 1000);
    expect(resolveBoundedTtlMs("invalid", PASSWORD_RESET_TTL_BOUNDS)).toBe(30 * 60 * 1000);
    expect(resolveBoundedTtlMs("999999", EMAIL_VERIFICATION_TTL_BOUNDS)).toBe(
      7 * 24 * 60 * 60 * 1000
    );
  });
});
