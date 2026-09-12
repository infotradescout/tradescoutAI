import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const shellState = vi.hoisted(() => ({
  location: "/verification",
  authenticated: true,
  mobile: false,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: shellState.authenticated }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => shellState.mobile }));
vi.mock("wouter", () => ({
  useLocation: () => [shellState.location],
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("./AppShellCore", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/navigation/ProductNavigator", () => ({
  default: () => <button type="button">All tools</button>,
}));

import { AppShell } from "./AppShell";

function renderShell() {
  return renderToStaticMarkup(
    <AppShell>
      <p>Verification content</p>
    </AppShell>
  );
}

describe("recommendation verification shell behavior", () => {
  beforeEach(() => {
    shellState.location = "/verification";
    shellState.authenticated = true;
    shellState.mobile = false;
  });

  it.each([
    "/u/acme-repair?trustAction=recommend",
    "/contractors/acme-repair?trustAction=recommend",
  ])("keeps %s confirmation focused while retaining its content and theme", (continuation) => {
    shellState.location = `/verification?next=${encodeURIComponent(continuation)}`;
    const html = renderShell();
    expect(html).toContain("Verification content");
    expect(html).toContain('data-ts-core-ui="true"');
    expect(html).not.toContain('data-testid="desktop-app-rail"');
    expect(html).not.toContain("All tools");
  });

  it.each([
    "/verification",
    "/verification?next=%2Fdirect-connect",
    "/verification?next=%2Fu%2Facme-repair%3FtrustAction%3Dcontact",
    "/verification?next=%2Fu%2Facme-repair%3FtrustAction%3Drecommend&next=%2Fdirect-connect",
  ])("retains desktop navigation for ordinary or unsupported continuations: %s", (location) => {
    shellState.location = location;
    const html = renderShell();
    expect(html).toContain('data-testid="desktop-app-rail"');
    expect(html).toContain("All tools");
  });

  it("keeps the desktop rail absent on mobile and signed-out screens", () => {
    shellState.mobile = true;
    expect(renderShell()).not.toContain('data-testid="desktop-app-rail"');
    shellState.mobile = false;
    shellState.authenticated = false;
    expect(renderShell()).not.toContain('data-testid="desktop-app-rail"');
  });
});
