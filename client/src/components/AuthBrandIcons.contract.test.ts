import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("login and registration social controls", () => {
  it("uses only the local decorative brand icons at all three existing sites", () => {
    const login = read("client/src/components/LoginForm.tsx");
    const register = read("client/src/components/RegisterForm.tsx");
    expect(login.match(/<GoogleBrandIcon\b/g)).toHaveLength(1);
    expect(login.match(/<FacebookBrandIcon\b/g)).toHaveLength(1);
    expect(register.match(/<FacebookBrandIcon\b/g)).toHaveLength(1);
    expect(`${login}\n${register}`).not.toContain("react-icons");
  });

  it("preserves labels, test ids, and authentication destinations", () => {
    const login = read("client/src/components/LoginForm.tsx");
    const register = read("client/src/components/RegisterForm.tsx");
    expect(login).toContain('data-testid="button-google-login"');
    expect(login).toContain("Continue with Google");
    expect(login).toContain('buildApiUrl("/api/auth/google")');
    expect(login).toContain('data-testid="button-facebook-login"');
    expect(login).toContain("Continue with Facebook");
    expect(login).toContain('buildApiUrl("/api/auth/facebook")');
    expect(register).toContain('data-testid="button-facebook-signup"');
    expect(register).toContain("Sign up with Facebook");
    expect(register).toContain("`${apiBaseUrl}/api/auth/facebook`");
  });
});
