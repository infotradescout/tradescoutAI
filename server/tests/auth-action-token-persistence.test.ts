import { describe, expect, it, vi } from "vitest";
import { EmailVerificationService } from "../services/emailVerificationService";
import { PasswordResetService } from "../services/passwordResetService";

describe("durable auth action tokens", () => {
  it("persists and atomically consumes email-verification token hashes", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: "user-1" }] })
      .mockResolvedValueOnce({ rows: [] });
    const service = new EmailVerificationService({ query } as any, 60_000);

    const created = await service.createToken("user-1");
    const storedHash = query.mock.calls[0][1][1];

    expect(query.mock.calls[0][0]).toContain("public.auth_action_tokens");
    expect(storedHash).not.toBe(created.token);
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    await expect(service.consumeToken(created.token)).resolves.toBe("user-1");
    expect(query.mock.calls[1][0]).toContain("DELETE FROM public.auth_action_tokens");
    expect(query.mock.calls[1][1]).toEqual(["email_verification", storedHash]);
    await expect(service.consumeToken(created.token)).resolves.toBeNull();
  });

  it("persists reset links and one current reset code, then consumes each once", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: "user-2" }] })
      .mockResolvedValueOnce({ rows: [{ user_id: "user-2" }] })
      .mockResolvedValueOnce({ rows: [] });
    const service = new PasswordResetService({ query } as any, 60_000);

    const created = await service.createToken("user-2");
    const createSql = query.mock.calls[0][0];
    const resetHash = query.mock.calls[0][1][1];
    const codeHash = query.mock.calls[0][1][2];

    expect(createSql).toContain("'password_reset'");
    expect(createSql).toContain("'password_reset_code'");
    expect(createSql).toContain("ON CONFLICT (user_id)");
    expect(resetHash).not.toBe(created.token);
    expect(codeHash).not.toBe(created.code);
    await expect(service.consumeToken(created.token)).resolves.toBe("user-2");
    await expect(service.consumeCodeForUser("user-2", created.code)).resolves.toBe(true);
    await expect(service.consumeCodeForUser("user-2", created.code)).resolves.toBe(false);
  });
});
